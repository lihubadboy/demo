define([
  'dojo/_base/declare',
  'dojo/_base/lang',
  'esri/geometry/Point',
  'esri/geometry/SpatialReference',
  'esri/views/3d/externalRenderers',
  'esri/tasks/QueryTask',
  'esri/tasks/support/Query',
  'esri/geometry/support/webMercatorUtils',
  "esri/geometry/projection",
  "esri/core/watchUtils",
], function (declare, lang, Point, SpatialReference, externalRenderers, QueryTask, Query, webMercatorUtils, projection, watchUtils) {
  // Enforce strict mode
  'use strict';

  // Constants
  var THREE = window.THREE;

  var ODLineLayer = declare(null, {
    constructor: function (view, options) {
      options = options || {};
      this.view = view;
      this.queryUrl = options.queryUrl || '';
      this.parColor = options.color || [255, 255, 255];
      this.parLength = options.length || 0.3;
      this.parSpeed = options.speed || 0.5;
      this.parSize = options.size || 4;
      this.isShow=options.isShow || true;

      this.commonUniforms = {
        time: {
          value: 0
        },
        number: {
          value: 1
        },
        speed: {
          value: this.parSpeed
        },
        length: {
          value: this.parLength
        },
        size: {
          value: this.parSize
        },
        isshow:{
          value:this.isShow
        }
      };
      this.groupDots = null;
      this.groupLines = null;
      this.groupAnimDots = null;
      //创建小球
      var createSphere = function () {
        var geometry = new THREE.SphereBufferGeometry(1);
        var material = new THREE.MeshBasicMaterial({
          color: this.parColor
        });
        var mesh = new THREE.Mesh(geometry, material);
        return mesh;
      }
      // 预制件
      this.Prefab = {
        Sphere: (function () {
          var instance;
          return function (clone = true) {
            if (!instance) {
              instance = new createSphere();
            }
            if (clone) return instance.clone();
            else return instance;
          }
        })()
      }
    },
    setup: function (context) {
      this.renderer = new THREE.WebGLRenderer({
        context: context.gl, // 可用于将渲染器附加到已有的渲染环境(RenderingContext)中
        premultipliedAlpha: false, // renderer是否假设颜色有 premultiplied alpha. 默认为true
      });
      this.renderer.setPixelRatio(window.devicePixelRatio); // 设置设备像素比。通常用于避免HiDPI设备上绘图模糊
      this.renderer.setViewport(0, 0, this.view.width, this.view.height); // 视口大小设置

      // 防止Three.js清除ArcGIS JS API提供的缓冲区。
      this.renderer.autoClearDepth = false; // 定义renderer是否清除深度缓存
      this.renderer.autoClearStencil = false; // 定义renderer是否清除模板缓存
      this.renderer.autoClearColor = false; // 定义renderer是否清除颜色缓存

      // ArcGIS JS API渲染自定义离屏缓冲区，而不是默认的帧缓冲区。
      // 我们必须将这段代码注入到three.js运行时中，以便绑定这些缓冲区而不是默认的缓冲区。
      const originalSetRenderTarget = this.renderer.setRenderTarget.bind(
        this.renderer
      );
      this.renderer.setRenderTarget = function (target) {
        originalSetRenderTarget(target);
        if (target == null) {
          // 绑定外部渲染器应该渲染到的颜色和深度缓冲区
          context.bindRenderTarget();
        }
      };

      this.scene = new THREE.Scene(); // 场景
      this.camera = new THREE.PerspectiveCamera(); // 相机
      // 添加坐标轴辅助工具
      const axesHelper = new THREE.AxesHelper(1);
      axesHelper.position.copy(1000000, 100000, 100000);
      this.scene.add(axesHelper);

      // setup scene lighting
      this.ambient = new THREE.AmbientLight(0xffffff, 0.5);
      this.scene.add(this.ambient);
      this.sun = new THREE.DirectionalLight(0xffffff, 0.5);
      this.sun.position.set(-600, 300, 60000);
      this.scene.add(this.sun);

      //创建粒子用到
      this.groupDots = new THREE.Group();
      this.groupLines = new THREE.Group();
      this.groupAnimDots = new THREE.Group();
      this.scene.add(this.groupDots, this.groupLines, this.groupAnimDots);

      this.getCoords(context);
      this.clock = new THREE.Clock();
      context.resetWebGLState();
    },
    render: function (context) {
      // 更新相机参数
      const cam = context.camera;
      this.camera.position.set(cam.eye[0], cam.eye[1], cam.eye[2]);
      this.camera.up.set(cam.up[0], cam.up[1], cam.up[2]);
      this.camera.lookAt(
        new THREE.Vector3(cam.center[0], cam.center[1], cam.center[2])
      );
      // 投影矩阵可以直接复制
      this.camera.projectionMatrix.fromArray(cam.projectionMatrix);
      // 更新
      this.commonUniforms.time.value += 0.01;
      // 绘制场景
      this.renderer.state.reset();
      this.renderer.render(this.scene, this.camera);
      // 请求重绘视图。
      externalRenderers.requestRender(this.view);
      // cleanup
      context.resetWebGLState();
    },
    getCoords: function (context) {
      // //获取线坐标
      var queryTask = new QueryTask({
        url: this.queryUrl
      });
      var query = new Query();
      query.returnGeometry = true;
      //query.outFields = ["*"];
      query.where = "1=1";
      var that = this;
      queryTask.execute(query).then(function (results) {
        for (var k = 0; k < results.features.length; k++) {
          var paths = results.features[k].geometry.paths[0];
          //将点转成成对坐标点
          var linePointsArray = [];
          for (var i = 0; i < paths.length - 1; i++) {
            linePointsArray.push([paths[i], paths[i + 1]]);
          }
          that.addPathPoints(linePointsArray);
        }
      });
      //context.resetWebGLState();
    },
    addPathPoints: function (linePoints) {
      var initnum = 3000;
      var totalLen = 0;
      var totalPaths = [];
      //计算线段总长度
      for (var k = 0; k < linePoints.length; k++) {
        var startPoint = new Array(3);
        var endPoint = new Array(3);
        externalRenderers.toRenderCoordinates(this.view, [linePoints[k][0][0], linePoints[k][0][1], 10], 0, this.view.spatialReference, startPoint, 0, 1);
        externalRenderers.toRenderCoordinates(this.view, [linePoints[k][1][0], linePoints[k][1][1], 10], 0, this.view.spatialReference, endPoint, 0, 1);
        var startPos = new THREE.Vector3(startPoint[0], startPoint[1], startPoint[2]);
        var endPos = new THREE.Vector3(endPoint[0], endPoint[1], endPoint[2]);
        var totalLen = totalLen + endPos.clone().sub(startPos).length();
      }
      for (var i = 0; i < linePoints.length; i++) {
        var point1 = linePoints[i][0];
        var point2 = linePoints[i][1];
        var xyz1 = new Array(3);
        var xyz2 = new Array(3);
        externalRenderers.toRenderCoordinates(this.view, [point1[0], point1[1], 10], 0, this.view.spatialReference, xyz1, 0, 1);
        externalRenderers.toRenderCoordinates(this.view, [point2[0], point2[1], 10], 0, this.view.spatialReference, xyz2, 0, 1);

        var vec0 = new THREE.Vector3(xyz1[0], xyz1[1], xyz1[2]);
        var vec3 = new THREE.Vector3(xyz2[0], xyz2[1], xyz2[2]);
        //根据线段长度计算，每段取点数量
        var dir = vec3.clone().sub(vec0);
        var len = dir.length();
        var num = parseInt(len / totalLen * initnum) + 1;
        totalPaths = totalPaths.concat(this.getLinePoints(vec0, vec3, num));
      }
      var geometry = new THREE.BufferGeometry().setFromPoints(totalPaths);
      let length = totalPaths.length;
      var percents = new Float32Array(length);
      for (let i = 0; i < length; i += 1) {
        percents[i] = (i / length);
      }
      geometry.addAttribute('percent', new THREE.BufferAttribute(percents, 1));

      var material = this.createLineMaterial();
      var flyLine = new THREE.Points(geometry, material);
      this.groupLines.add(flyLine);
    },
    //一条线
    getLinePoints: function (v0, v3, num) {
      //根据两点坐标，计算取两点连线上的坐标点
      var paths = [];
      for (var k = 0; k < num; k++) {
        var dir = v3.clone().sub(v0);
        var len = dir.length();
        dir = dir.normalize().multiplyScalar(len * k / (num));
        var newVec = v0.clone().add(dir);
        paths.push(new THREE.Vector3(newVec.x, newVec.y, newVec.z));
      }
      return paths;
    },
    //线条材质
    createLineMaterial: function () {
      let uniforms = {
        time: this.commonUniforms.time,
        number: this.commonUniforms.number,
        speed: this.commonUniforms.speed,
        length: this.commonUniforms.length,
        size: this.commonUniforms.size,
        color: {
          value: new THREE.Color(this.parColor)
        },
        isshow:this.commonUniforms.isshow,
      };
      var shader = this.getShaderStr();
      var material = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: shader.vs,
        fragmentShader: shader.fs,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        alphaTest: false,
      });

      return material;
    },
    getShaderStr: function () {
      var shader = {};
      var vertexShader = `
      attribute float percent;
      uniform float time;
      uniform float number;
      uniform float speed;
      uniform float length;
      varying float opacity;
      uniform float size;
      void main()
      {
        float l = clamp(1.0-length, 0.0, 1.0);
        gl_PointSize = clamp(fract(percent*number + l - time*number*speed)-l, 0.0, 1.) * size * (1./length);
        opacity = gl_PointSize/size;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
      `;
      var fragmentShader = `
      varying float opacity;
      uniform vec3 color;
      uniform bool isshow;
      void main(){
          if (opacity <=0.1){
            if(isshow){
              gl_FragColor = vec4(color, 0.1);
            }else{
              discard;
            }
          }else{
            gl_FragColor = vec4(color, 1.0);
          }
      }
      `;
      shader.vs = vertexShader;
      shader.fs = fragmentShader;
      return shader;
    },
    dispose: function (content) { }
  });
  return ODLineLayer
});