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

  var PyramidLayer = declare(null, {
    constructor: function (view, options) {
      options = options || {};
      this.view = view;
      this.position = options.position || [0, 0, 0];
      this.radius = options.radius || 1000;
      this.renderObject = null;
      this.angle = 0;
      this.isUp = true;
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

      //动画效果
      if (this._uniforms) {
        this._uniforms.time.value = this._uniforms.time.value + 0.005;
      }

      if (this.renderObject) {
        this.renderObject.rotation.z += 0.02;
        if (this.isUp) {
          this.renderObject.position.z += 50;
          if (this.renderObject.position.z > 3000) {
            this.isUp = false;
          }
        }else{
          this.renderObject.position.z -= 50;
          if (this.renderObject.position.z < 750) {
            this.isUp = true;
          }
        }


      }
      if (this.angle) {
        this.angle = this.angle + 0.05;
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
    getGeometry: function (context) {
      debugger;
      var cenP = [];
      externalRenderers.toRenderCoordinates(this.view, this.position, 0, this.view.spatialReference, cenP, 0, 1);
      let geometry = new THREE.CylinderBufferGeometry(1000, 0, 1500, 4);
      geometry.rotateX(Math.PI / 2);
      geometry.computeBoundingSphere();

      this.renderObject = new THREE.Object3D();
      var mesh = new THREE.Mesh(geometry, this.getMaterial());
      this.renderObject.add(mesh);
      this.renderObject.position.set(cenP[0], cenP[1], cenP[2] + 500);
      this.scene.add(this.renderObject);
      context.resetWebGLState();
    },
    getMaterial: function () {
      this._uniforms = {
        dtPyramidTexture: {
          value: new THREE.TextureLoader().load("images/test-4.png")
        },
        time: {
          value: 0.0
        },
        uColor: {
          value: new THREE.Color("#5588aa")
        }
      };
      let shader = this.getShaderStr();
      let material = new THREE.ShaderMaterial({
        uniforms: this._uniforms,
        vertexShader: shader.vs,
        fragmentShader: shader.fs,
        transparent: true,
        side: THREE.DoubleSide,
      });
      return material;
    },
    getShaderStr: function () {
      let shader = { vs: '', fs: '' };

      shader.vs = 'varying vec2 vUv;\n' +
        'void main(){\n' +
        'vUv = uv;\n' +
        'gl_Position = projectionMatrix*viewMatrix*modelMatrix*vec4( position, 1.0 );\n' +
        '}\n';

      shader.fs = 'uniform float time;\n' +
        'varying vec2 vUv;\n' +
        'uniform sampler2D dtPyramidTexture;\n' +
        'uniform vec3 uColor;\n' +
        'void main() {\n' +
        ' vec2 st = vUv;\n' +
        ' vec4 colorImage = texture2D(dtPyramidTexture, vec2(vUv.x,fract(vUv.y-time)));\n' +
        //'float alpha=mix(0.1,1.0,clamp((1.0-vUv.y) * uColor.a,0.0,1.0)) +(1.0-sign(vUv.y-time*0.001))*0.2*(1.0-colorImage.r);\n'+
        'vec3 diffuse =(1.0-colorImage.a)*vec3(0.8,1.0,0.0)+colorImage.rgb*vec3(0.8,1.0,0);\n' +
        'gl_FragColor = vec4(diffuse,0.7);\n' +
        '}\n';
      return shader;
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
  return PyramidLayer
});