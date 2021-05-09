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

  var IconCliderLayer = declare(null, {
    constructor: function (view, options) {
      options = options || {};
      this.view = view;
      this.position = options.position || [0, 0, 0];
      this.radius = options.radius || 1000;
      this.icon = options.icon || 'images/circular2.png';
      this.renderObject = null;
    },
    setup: function (context) {
      this.renderer = new THREE.WebGLRenderer({
        context: context.gl, // 可用于将渲染器附加到已有的渲染环境(RenderingContext)中
        premultipliedAlpha: false, // renderer是否假设颜色有 premultiplied alpha. 默认为true
      });
      this.renderer.setPixelRatio(window.devicePixelRatio); // 设置设备像素比。通常用于避免HiDPI设备上绘图模糊
      this.renderer.setViewport(0, 0, this.view.width, this.view.height); // 视口大小设置
      // this.renderer.setSize(context.camera.fullWidth, context.camera.fullHeight);

      // Make sure it does not clear anything before rendering
      this.renderer.autoClear = false;
      this.renderer.autoClearDepth = false;
      this.renderer.autoClearColor = false;
      // this.renderer.autoClearStencil = false;

      // The ArcGIS JS API renders to custom offscreen buffers, and not to the default framebuffers.
      // We have to inject this bit of code into the three.js runtime in order for it to bind those
      // buffers instead of the default ones.
      var originalSetRenderTarget = this.renderer.setRenderTarget.bind(this.renderer);
      this.renderer.setRenderTarget = function (target) {
        originalSetRenderTarget(target);
        if (target == null) {
          context.bindRenderTarget();
        }
      };

      this.scene = new THREE.Scene();
      // setup the camera
      var cam = context.camera;
      this.camera = new THREE.PerspectiveCamera(cam.fovY, cam.aspect, cam.near, cam.far);


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
      //var geometrys = this.getCoords(context);
      //var canvas = this.produceCanvas();
      this.clock = new THREE.Clock();
      this.getGeometry(context);
      context.resetWebGLState();
    },
    render: function (context) {
      var cam = context.camera;
      //需要调整相机的视角
      this.camera.position.set(cam.eye[0], cam.eye[1], cam.eye[2]);
      this.camera.up.set(cam.up[0], cam.up[1], cam.up[2]);
      this.camera.lookAt(new THREE.Vector3(cam.center[0], cam.center[1], cam.center[2]));
      // Projection matrix can be copied directly
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
      if (this.renderObject) {
        this.renderObject.rotation.y += 0.03;
        if (this.renderObject.rotation.y > 2 * Math.pi) this.renderObject.rotation.y = 0;
      }
      // draw the scene
      /////////////////////////////////////////////////////////////////////////////////////////////////////
      this.renderer.state.reset();
      this.renderer.render(this.scene, this.camera);
      // as we want to smoothly animate the ISS movement, immediately request a re-render
      externalRenderers.requestRender(this.view);
      // cleanup
      context.resetWebGLState();
    },
    produceCanvas: function (img) {
      var canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 216;
      var ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, 512, 256);
      ctx.drawImage(img, 0, 0);
      var imageD = ctx.getImageData(0, 0, img.width, img.height);
      var pdata = imageD.data;
      for (var j = 0; j < pdata.length; j += 4) {
        pdata[j] = 71;
        pdata[j + 1] = 245;
        pdata[j + 2] = 241;
      }
      ctx.putImageData(imageD, 0, 0);
      return canvas;
    },
    getGeometry: function (context) {

      var _self = this;
      var img = new Image();
      img.src = this.icon;
      img.onload = function () {
        var texture = new THREE.CanvasTexture(_self.produceCanvas(img));
        texture.needsUpdate = true;
        texture.repeat.x = 1;
        var geo = new THREE.CylinderGeometry(_self.radius, _self.radius, _self.radius * 2, 100, 1, true);
        var material = new THREE.MeshPhongMaterial({
          map: texture,
          opacity: 1,
          transparent: true
        })
        _self.renderObject = _self.transparentObject(geo, material);
        _self.renderObject.rotateX(Math.PI / 2);
        var cenP = [];
        externalRenderers.toRenderCoordinates(_self.view, _self.position, 0, _self.view.spatialReference, cenP, 0, 1);
        _self.renderObject.position.set(cenP[0], cenP[1], cenP[2]);
        _self.scene.add(_self.renderObject);
        context.resetWebGLState();
      }




      // var cenP = [];
      // externalRenderers.toRenderCoordinates(this.view, this.position, 0, this.view.spatialReference, cenP, 0, 1);
      // let url = this.icon;
      // const textureLoader = new THREE.TextureLoader();
      // var that = this;
      // var map = textureLoader.load(url, function (map) {
      //   //var map = textureLoader.load(url);
      //   map.repeat.x = 2;
      //   var geo = new THREE.CylinderGeometry(this.radius, this.radius, 500, 100, 1, true);
      //   geo.translate(0, 15, 0);

      //   var material = new THREE.MeshPhongMaterial({
      //     side: THREE.FrontSide,
      //     transparent: true, // 必须设置为true,alphaMap才有效果
      //     depthWrite: false, // 渲染此材质是否对深度缓冲区有任何影响
      //     map: map,
      //     depthTest: false
      //   });

      //   var material = new THREE.MeshPhongMaterial({
      //     side: THREE.BackSide,
      //     transparent: true, // 必须设置为true,alphaMap才有效果
      //     depthWrite: false, // 渲染此材质是否对深度缓冲区有任何影响
      //     map: map,
      //     depthTest: false
      //   });
      //   that.renderObject = that.transparentObject(geo, material);
      //   that.renderObject.rotateX(Math.PI / 2);
      //   that.renderObject.position.set(cenP[0], cenP[1], cenP[2]);
      //   that.scene.add(that.renderObject);
      //   context.resetWebGLState();
      // });
    },
    transparentObject: function (geometry, material) {
      var obj = new THREE.Object3D();
      var mesh = new THREE.Mesh(geometry, material);
      mesh.material.side = THREE.BackSide; // back faces
      mesh.renderOrder = 0;
      obj.add(mesh);

      var mesh = new THREE.Mesh(geometry, material.clone());
      mesh.material.side = THREE.FrontSide; // front faces
      mesh.renderOrder = 1;
      obj.add(mesh);
      return obj
    },
    dispose: function (content) { }
  });
  return IconCliderLayer
});