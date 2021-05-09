define([
  'dojo/_base/declare',
  'dojo/_base/lang',
  'esri/geometry/Point',
  'esri/geometry/SpatialReference',
  'esri/views/3d/externalRenderers',
  'esri/tasks/QueryTask',
  'esri/tasks/support/Query',
  'esri/geometry/support/webMercatorUtils',
  "esri/core/watchUtils",
], function (declare, lang, Point, SpatialReference, externalRenderers, QueryTask, Query, webMercatorUtils, watchUtils) {
  // Enforce strict mode
  'use strict';

  // Constants
  var THREE = window.THREE;

  var LightBdLayer = declare(null, {
    constructor: function (view, options) {
      options = options || {};
      this.view = view;
      this.queryUrl = options.queryUrl || '';
      this.height = options.height || 1000;
      this.texture = null;
      this.offset = 0;
    },
    setup: function (context) {
      this.renderer = new THREE.WebGLRenderer({
        context: context.gl, // 可用于将渲染器附加到已有的渲染环境(RenderingContext)中
        premultipliedAlpha: false, // renderer是否假设颜色有 premultiplied alpha. 默认为true
      });
      this.renderer.setPixelRatio(window.devicePixelRatio); // 设置设备像素比。通常用于避免HiDPI设备上绘图模糊
      this.renderer.setViewport(0, 0, view.width, view.height); // 视口大小设置

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
      
      //建筑高亮
      this._uniforms = {
        time: { value: 0.0 },
        colorTexture: { value: new THREE.TextureLoader().load("images/tex1.png") },
        colorTexture1: { value: new THREE.TextureLoader().load("images/test-4.png") },
      };


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
      // update lighting
      /////////////////////////////////////////////////////////////////////////////////////////////////////
      // view.environment.lighting.date = Date.now();
      var l = context.sunLight;
      this.sun.position.set(
        l.direction[0],
        l.direction[1],
        l.direction[2]
      );
      this.sun.intensity = l.diffuse.intensity;
      this.sun.color = new THREE.Color(l.diffuse.color[0], l.diffuse.color[1], l.diffuse.color[2]);
      this.ambient.intensity = l.ambient.intensity;
      this.ambient.color = new THREE.Color(l.ambient.color[0], l.ambient.color[1], l.ambient.color[2]);


      // 更新
      if (this._uniforms) {
        this._uniforms.time.value += 0.01;
      }
      // 绘制场景
      this.renderer.state.reset();
      this.renderer.render(this.scene, this.camera);
      // 请求重绘视图。
      externalRenderers.requestRender(view);
      // cleanup
      context.resetWebGLState();
    },
    getCoords: function (context) {
      var queryTask = new QueryTask({
        url: this.queryUrl
      });
      var query = new Query();
      query.returnGeometry = true;
      query.outFields = ["*"];
      query.where = "1=1";
      var that = this;
      queryTask.execute(query).then(function (results) {
        console.log(results.features);
        for (var k = 0; k < results.features.length; k++) {
          if (k <= 15) {
            var rings = results.features[k].geometry.rings[0];//默认一个环
            var coordsArray = new Array(rings.length * 3);
            var begin = new Array(rings.length * 3);
            for (var i = 0; i < rings.length; i++) {
              begin[i * 3] = rings[i][0];
              begin[i * 3 + 1] = rings[i][1];
              begin[i * 3 + 2] = 100;
            }
            externalRenderers.toRenderCoordinates(that.view, begin, 0, that.view.spatialReference, coordsArray, 0, rings.length);
            //创建拉伸建筑
            that.createGeometry(coordsArray);
            //高亮建筑
            that.createLightGeometry(coordsArray);
          }
        }
        context.resetWebGLState();
      });
    },
    assignUVs: function (geometry) {
      geometry.computeBoundingBox();
      var max = geometry.boundingBox.max,
        min = geometry.boundingBox.min;
      var offset = new THREE.Vector2(0 - min.x, 0 - min.y);
      var range = new THREE.Vector2(max.x - min.x, max.y - min.y);
      var faces = geometry.faces;
      geometry.faceVertexUvs[0] = [];
      for (var i = 0; i < faces.length; i++) {
        var v1 = geometry.vertices[faces[i].a],
          v2 = geometry.vertices[faces[i].b],
          v3 = geometry.vertices[faces[i].c];
        geometry.faceVertexUvs[0].push([
          new THREE.Vector2((v1.x + offset.x) / range.x, (v1.y + offset.y) / range.y),
          new THREE.Vector2((v2.x + offset.x) / range.x, (v2.y + offset.y) / range.y),
          new THREE.Vector2((v3.x + offset.x) / range.x, (v3.y + offset.y) / range.y)
        ]);
      }
      geometry.uvsNeedUpdate = true;
    },
    createGeometry: function (coordsArray) {
      const shape = new THREE.Shape();//底面几何
      const lineMaterial = new THREE.LineBasicMaterial({ color: '#00ecb7', linewidth: 10 });//轮廓线
      const linGeometry = new THREE.Geometry();
      for (var j = 0; j < coordsArray.length; j = j + 3) {
        var x = coordsArray[j];
        var y = coordsArray[j + 1];
        if (j === 0) {
          shape.moveTo(x, y);
        }
        shape.lineTo(x, y);
        linGeometry.vertices.push(new THREE.Vector3(x, y, 1));
      }
      const extrudeSettings = {
        depth: this.height,
        bevelEnabled: false
      };
      var geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

      //this.assignUVs(geometry);
      var material = new THREE.MeshPhongMaterial({ color: new THREE.Color('#4d4aea'), transparent: true, opacity: 0.7 });
      var mesh = new THREE.Mesh(geometry, material.clone())
      // var mesh2 = new THREE.Mesh(geometry, this.getMaterial());
      this.scene.add(mesh);
      //this.scene.add(mesh2);
    },
    createLightGeometry: function (coordsArray) {
      var points = [];
      for (var j = 0; j < coordsArray.length; j = j + 3) {
        var x = coordsArray[j];
        var y = coordsArray[j + 1];
        points.push([x, y])
      }
      // 计算顶点
      let transform = new THREE.Matrix4(); // 变换矩阵
      const num = points.length;
      let transformation = new Array(4 * num);
      let vector3List = []; // 顶点数组
      let faceList = []; // 三角面数组
      let faceVertexUvs = []; // 面的 UV 层的队列，该队列用于将纹理和几何信息进行映射
      // 转换顶点坐标
      points.forEach((point) => {
        transform.fromArray(
          externalRenderers.renderCoordinateTransformAt(
            this.view,
            [point[0], point[1], 0], // 坐标在地面上的点[x值, y值, 高度值]
            this.view.spatialReference,
            transformation
          )
        );
        vector3List.push(
          new THREE.Vector3(
            transform.elements[12],
            transform.elements[13],
            transform.elements[14]
          )
        );
        // 再转换距离地面高度为height的点
        transform.fromArray(
          externalRenderers.renderCoordinateTransformAt(
            this.view,
            [point[0], point[1], this.height], // 坐标在空中的点[x值, y值, 高度值]
            this.view.spatialReference,
            transformation
          )
        );
        vector3List.push(
          new THREE.Vector3(
            transform.elements[12],
            transform.elements[13],
            transform.elements[14]
          )
        );
      });

      // 纹理坐标
      const t0 = new THREE.Vector2(0, 0); // 图片左下角
      const t1 = new THREE.Vector2(1, 0); // 图片右下角
      const t2 = new THREE.Vector2(1, 1); // 图片右上角
      const t3 = new THREE.Vector2(0, 1); // 图片左上角
      // 生成几何体三角面
      for (let i = 0; i < vector3List.length - 2; i++) {
        if (i % 2 === 0) {
          faceList.push(new THREE.Face3(i, i + 2, i + 1));
          faceVertexUvs.push([t0, t1, t3]);
        } else {
          faceList.push(new THREE.Face3(i, i + 1, i + 2));
          faceVertexUvs.push([t3, t1, t2]);
        }
      }
      // 几何体
      const geometry = new THREE.Geometry();
      geometry.vertices = vector3List;
      geometry.faces = faceList;
      geometry.faceVertexUvs[0] = faceVertexUvs;
      var mesh = new THREE.Mesh(geometry, this.getMaterial());
      this.scene.add(mesh);
    },
    getMaterial: function () {
      let shader = this.getShaderStr();
      let material = new THREE.ShaderMaterial({
        uniforms: this._uniforms,
        vertexShader: shader.vs,
        fragmentShader: shader.fs,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthTest: false,
        side: THREE.DoubleSide,
        //polygonOffset:true
      });
      return material;
    },
    getShaderStr: function () {
      let shader = { vs: '', fs: '' };

      shader.vs = ` 
      varying vec2 vUv;\n
      varying vec3 fNormal;\n
      varying vec3 vPosition;\n
      void main()\n
      {\n
          vUv = uv;\n
          fNormal=normal;\n
          vPosition=position;\n
          vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );\n
          gl_Position = projectionMatrix * mvPosition;\n
      }\n`;

      shader.fs = `
       uniform float time;\n
       varying vec2 vUv;\n
       uniform sampler2D colorTexture;\n
       uniform sampler2D colorTexture1;\n
       varying vec3 fNormal;\n
       varying vec3 vPosition;\n
       void main( void ) {\n
           vec2 position = vUv;\n
           vec3 tempNomal= normalize(fNormal);\n
           float power=step(0.95,abs(tempNomal.y));\n
           vec4 colorb=texture2D(colorTexture1,position.xy);\n
           vec4 colora = texture2D(colorTexture,vec2(vUv.x,fract(vUv.y-time))); \n
           if(power>0.95){\n
               gl_FragColor =colorb;\n
           }else{\n
               gl_FragColor =colorb+colorb*colora;\n  
           }\n         
       }\n`;
      return shader;
    },
    dispose: function (content) { }
  });
  return LightBdLayer
});