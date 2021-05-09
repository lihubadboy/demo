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

  var BloomLayer = declare(null, {
    constructor: function (view, options) {
      options = options || {};
      this.view = view;
      this.position = options.position || [0, 0, 0];
      this.radius = options.radius || 1000;
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
      // draw the scene
      /////////////////////////////////////////////////////////////////////////////////////////////////////
      this.renderer.state.reset();
      this.renderer.render(this.scene, this.camera);
      // as we want to smoothly animate the ISS movement, immediately request a re-render
      externalRenderers.requestRender(this.view);
      // cleanup
      context.resetWebGLState();
    },
    getGeometry: function (context) {
      var cenP = [];
      externalRenderers.toRenderCoordinates(this.view, this.position, 0, this.view.spatialReference, cenP, 0, 1);
      var sphereGeom = new THREE.SphereGeometry(this.radius, 200, 200, 0, Math.PI * 2, 0, Math.PI / 2);//半球几何
      this.material = this.getMaterial();
      var mesh = new THREE.Mesh(sphereGeom.clone(), this.material);
      mesh.position.set(cenP[0],cenP[1],cenP[2]);
      mesh.rotateX(Math.PI / 2);//绕x轴旋转
      this.scene.add(mesh);
      context.resetWebGLState();
    },
    getMaterial: function () {
      let uniforms = {
        "c": { type: "f", value: 1 },
        "p": { type: "f", value: 1.5 },
        glowColor: { type: "c", value: new THREE.Color('#f28000') },
        viewVector: { type: "v3", value: this.camera.position }
      };
      let shader = this.getShaderStr();
      let material = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: shader.vs,
        fragmentShader: shader.fs,
        side: THREE.FrontSide,
        blending: THREE.AdditiveBlending,
        transparent: true
        //depthWrite: false
      });
      return material;
    },
    getShaderStr: function () {
      let shader = { vs: '', fs: '' };

      shader.vs =
        'uniform vec3 viewVector;\n' +
        'uniform float c;\n' +
        'uniform float p;\n' +
        'varying float intensity;\n' +
        'void main(){\n' +
        'vec3 vNormal = normalize( normalMatrix * normal );\n' +
        'vec3 vNormel = normalize( normalMatrix * viewVector );\n' +
        'intensity = pow( c - dot(vNormal, vNormel), p );\n' +
        'gl_Position = projectionMatrix*viewMatrix*modelMatrix*vec4( position, 1.0 );\n' +
        '}\n';

      shader.fs =
        'uniform vec3 glowColor;\n' +
        'varying float intensity;\n' +
        'void main() {\n' +
        'vec3 glow = glowColor * intensity;\n' +
        'gl_FragColor = vec4( glow, 1.0 );\n' +
        '}\n';
      return shader;
    },
    dispose: function (content) { }
  });
  return BloomLayer
});