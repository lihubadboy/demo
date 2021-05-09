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

  var ODLineLayer = declare(null, {
    constructor: function (view, options) {
      options = options || {};
      this.view = view;
      this.queryUrl = options.queryUrl || '';
      this.parColor = options.color || [255, 255, 255];
      this.parLength = options.length || 50;
      this.parSpeed = options.speed || 5;
      if (this.parLength > 80) {
        this.parLength = 80;
      }
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

      //创建粒子用到
      this.particleSystems = new ParticleSystems(THREE, this.scene, this.camera);

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
      TWEEN.update();
      // 绘制场景
      this.renderer.state.reset();
      this.renderer.render(this.scene, this.camera);
      // 请求重绘视图。
      externalRenderers.requestRender(view);
      // cleanup
      context.resetWebGLState();
    },
    getCoords: function (context) {
      //获取线坐标
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
          var paths = results.features[k].geometry.paths[0];//默认一个环
          var coordsArray = new Array(paths.length * 3);
          var begin = new Array(paths.length * 3);
          for (var i = 0; i < paths.length; i++) {
            begin[i * 3] = paths[i][0];
            begin[i * 3 + 1] = paths[i][1];
            begin[i * 3 + 2] = 10;
          }
          externalRenderers.toRenderCoordinates(that.view, begin, 0, that.view.spatialReference, coordsArray, 0, paths.length);
          //获取线的顶点，创建OD线
          that.createODLine(coordsArray);
        }
        context.resetWebGLState();
      });
    },
    createODLine: function (coordsArray) {
      var points = [];
      for (var j = 0; j < coordsArray.length; j = j + 3) {
        var x = coordsArray[j];
        var y = coordsArray[j + 1];
        var z = coordsArray[j + 2];
        points.push([x, y, z])
      }
      // 计算顶点
      let transform = new THREE.Matrix4(); // 变换矩阵
      const num = points.length;
      let transformation = new Array(16);
      let vector3List = []; // 顶点数组
      let faceList = []; // 三角面数组
      let faceVertexUvs = []; // 面的 UV 层的队列，该队列用于将纹理和几何信息进行映射
      // 转换顶点坐标
      points.forEach((point) => {
        transform.fromArray(
          externalRenderers.renderCoordinateTransformAt(
            this.view,
            [point[0], point[1], point[2]],
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
      this.particleSystems.createODLineByPoints(vector3List, this.parColor, this.parLength, 10);

    },
    dispose: function (content) { }
  });
  return ODLineLayer
});