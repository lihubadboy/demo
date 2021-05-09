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

  var ParticlesLayer = declare(null, {
    constructor: function (view, options) {
      options = options || {};
      this.view = view;
      this.jsonPoints = options.jsonPoints || [];
      this.offset = 0;

      this.fsbObjs = [];
      this.parObjs = [];
      this.cylider_uniforms = [];

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
      //创建粒子用到
      this.particleSystems = new ParticleSystems(THREE, this.scene);
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

      //发射波mesh
      this.fsbObjs.forEach(lang.hitch(this, function (fsbMesh) {
        if (fsbMesh) {
          fsbMesh.rotation.z += 0.03;
          if (fsbMesh.scale.x >= 0 && fsbMesh.scale.x <= 1.2) {
            fsbMesh.scale.x += 0.02;
            fsbMesh.scale.y += 0.02;
            fsbMesh.scale.z += 0.02;
          } else {
            fsbMesh.scale.x = 0.01;
            fsbMesh.scale.y = 0.01;
            fsbMesh.scale.z = 0.01;
          }
        }
      }))
      //柱体
      this.cylider_uniforms.forEach(lang.hitch(this, function (uniforms) {
        uniforms.time.value += 0.5;
        if (uniforms.time.value > 10) {
          uniforms.time.value = 1;
        }
      }))
      //柱体粒子
      this.parObjs.forEach(lang.hitch(this, function (parObj) {
        parObj.rotation.y += 0.03;
        if (parObj.rotation.y > 2 * Math.pi) parObj.rotation.y = 0;
        //this.par_uniforms.u_image.value.offset.x += 0.1;
      }))

      // draw the scene
      /////////////////////////////////////////////////////////////////////////////////////////////////////
      this.renderer.state.reset();
      this.renderer.render(this.scene, this.camera);
      // as we want to smoothly animate the ISS movement, immediately request a re-render
      externalRenderers.requestRender(this.view);
      // cleanup
      context.resetWebGLState();
    },
    produceCanvasDm: function (color) {
      var canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      var context = canvas.getContext("2d");
      var gradient = context.createRadialGradient(256, 256, 0, 256, 256, 256);
      gradient.addColorStop(0.1, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 1.0)`);
      gradient.addColorStop(0.2, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.0)`);
      gradient.addColorStop(0.3, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.9)`);
      gradient.addColorStop(0.5, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.0)`);
      gradient.addColorStop(0.9, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.2)`);
      gradient.addColorStop(1.0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 1.0)`);

      context.clearRect(0, 0, 512, 512);
      context.beginPath();
      context.arc(256, 256, 256, 0, Math.PI * 2, true);
      // ctx.fillStyle = "rgb(0, 155, 255)";
      context.fillStyle = gradient;
      context.fill();
      context.restore();
      return canvas;
    },
    produceCanvasFsb: function (color) {
      var canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      var ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, 512, 512);

      ctx.strokeStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
      ctx.setLineDash([80, 80]);
      ctx.lineWidth = 30;
      ctx.arc(256, 256, 241, 0, Math.PI * 2, true);
      ctx.stroke();
      return canvas;
    },
    produceCanvasLabel: function () {
      var canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      var ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, 256, 256);
      var image = new Image();
      image.src = 'images/billboard2.png';
      ctx.drawImage(image, 0, 0);
      return canvas;
    },
    getGeometry: function (context) {
      this.jsonPoints.forEach(lang.hitch(this, function (stopPoint) {
        var cenP = [];
        var position = stopPoint[0];
        var color = stopPoint[1];
        var scale = stopPoint[2];
        externalRenderers.toRenderCoordinates(this.view, position, 0, this.view.spatialReference, cenP, 0, 1);
        var geometry = new THREE.CircleGeometry(scale[0], 300, Math.PI, 2 * Math.PI);

        var ground = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({
          map: new THREE.CanvasTexture(this.produceCanvasDm(color)),
          opacity: 1,
          transparent: true
        }));
        ground.position.set(cenP[0], cenP[1], cenP[2]);
        this.scene.add(ground);
        //底面发射波
        var fsbMesh = new THREE.Mesh(geometry.clone(), new THREE.MeshPhongMaterial({
          map: new THREE.CanvasTexture(this.produceCanvasFsb(color)),
          opacity: 1,
          transparent: true
        }));
        fsbMesh.position.set(cenP[0], cenP[1], cenP[2] + 100);
        this.scene.add(fsbMesh);
        this.fsbObjs.push(fsbMesh);

        //柱体
        // var cyliderGeo = new THREE.CylinderGeometry(3, 30, 1500, 100, 1, true);
        // this.renderObject = this.transparentObject(cyliderGeo, this.getMaterial(color));
        // this.renderObject.rotateX(Math.PI / 2);
        // this.renderObject.position.set(cenP[0], cenP[1], cenP[2]);
        // this.scene.add(this.renderObject);

        //柱体粒子
        // var lzGeo = new THREE.CylinderGeometry(600, 600, 15000, 100, 1, true);
        // var material = this.getMaterial_par(color);
        // var parObj = this.transparentObject(lzGeo, material);
        // parObj.rotateX(Math.PI / 2);
        // parObj.scale.set(1.5, 1.5, 1);
        // parObj.position.set(cenP[0], cenP[1], cenP[2]);
        // this.scene.add(parObj);
        // this.parObjs.push(parObj);
      }))
      //context.resetWebGLState();
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
   
    //柱体材质
    getMaterial: function (color) {
      var cylider_uniform = {
        time: { value: 1 },
        u_image: { value: new THREE.TextureLoader().load("images/test-4.png") },
        u_color: { value: new THREE.Color(`rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]})`) }
      };
      this.cylider_uniforms.push(cylider_uniform);
      let shader = this.getShaderStr();
      let material = new THREE.ShaderMaterial({
        uniforms: cylider_uniform,
        vertexShader: shader.vs,
        fragmentShader: shader.fs,
        side: THREE.DoubeSide,
        transparent: true
      });
      return material;
    },
    getShaderStr: function () {
      let shader = { vs: '', fs: '' };

      shader.vs = `
       varying vec2 v_st;
       varying vec3 v_normalEC;
       varying vec3 v_positionEC;
       varying vec4 v_color;
       void main()
       {
           v_st = uv;
           v_normalEC=normal;
           v_positionEC=position;
           vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
           gl_Position = projectionMatrix * mvPosition;
       }
       `;

      shader.fs = `
                varying vec3 v_positionEC;
                varying vec3 v_normalEC;
                varying vec2 v_st;
                varying vec4 v_color;
                uniform sampler2D u_image;
                uniform vec3 u_color;
                uniform float time;
                void main()
                {
                    vec4 colora = texture2D(u_image,vec2(v_st.x,fract(v_st.y-time)));
                    float alpha = colora.a;
                    gl_FragColor = vec4(u_color, alpha);
                }
                `;
      return shader;
    },
    //柱体粒子材质
    getMaterial_par: function (color) {
      this.par_uniforms = {
        time: { value: 1 },
        u_image: { value: undefined },
        u_color: { value: new THREE.Color(`rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3]})`) },
      };
      this.tx = new THREE.TextureLoader().load('images/particles.png');
      this.tx.wrapS = THREE.RepeatWrapping;
      this.tx.wrapT = THREE.RepeatWrapping;
      this.tx.repeat.x = 4;
      this.tx.repeat.y = 2;
      this.par_uniforms.u_image.value = this.tx;

      let shader = this.getShaderStr_par();
      let material = new THREE.ShaderMaterial({
        uniforms: this.par_uniforms,
        vertexShader: shader.vs,
        fragmentShader: shader.fs,
        side: THREE.DoubeSide,
        opacity: 1,
        transparent: true,
        depthWrite: false
      });
      return material;
    },
    getShaderStr_par: function () {
      let shader = { vs: '', fs: '' };

      shader.vs = `
           varying vec2 v_st;
           varying vec3 v_normalEC;
           varying vec3 v_positionEC;
           void main()
           {
               v_st = uv;
               v_normalEC=normal;
               v_positionEC=position;
               vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
               gl_Position = projectionMatrix * mvPosition;
           }
           `;

      shader.fs = `
                    varying vec3 v_positionEC;
                    varying vec3 v_normalEC;
                    varying vec2 v_st;
                    uniform sampler2D u_image;
                    uniform vec3 u_color;
                    void main()
                    {
                      vec4 mapColor=texture2D(u_image, v_st);
                      gl_FragColor = vec4(u_color, mapColor.a);
                    }
                    `;
      return shader;
    },
    //边缘发光的材质
    getMaterial2: function (texture) {
      var uniforms = {
        scale: { type: "f", value: -1.0 },
        bias: { type: "f", value: 1.0 },
        power: { type: "f", value: 3.3 },
        glowColor: { type: "c", value: new THREE.Color(0x00ffff) },
        textureMap: {
          value: undefined
        },
        repeat: {
          type: "v2",
          value: new THREE.Vector2(30.0, 15.0)
        },
        time: {
          value: 0.0
        }
      };
      let tx = new THREE.TextureLoader().load("images/particles.png");
      tx.wrapS = THREE.RepeatWrapping;
      tx.wrapT = THREE.RepeatWrapping;
      tx.repeat.x = 2;
      uniforms.textureMap.value = tx;
      let shader = this.getShaderStr2();
      let material = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: shader.vs,
        fragmentShader: shader.fs,
        side: THREE.DoubeSide,
        transparent: true,
      });
      return material;
    },
    getShaderStr2: function () {
      let shader = { vs: '', fs: '' };

      shader.vs = `
      varying vec3 vNormal;
      varying vec3 vPositionNormal;
      varying vec2 vUv;
      void main() 
      {
          vUv = uv;
          vNormal = normalize( normalMatrix * normal );
          vPositionNormal = normalize(( modelViewMatrix * vec4(position, 1.0) ).xyz);
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }
       `;

      shader.fs = `
      uniform vec3 glowColor;
      uniform float bias;
      uniform float power;
      uniform float scale;
      varying vec3 vNormal;
      varying vec3 vPositionNormal;
      uniform sampler2D textureMap;
      uniform vec2 repeat;
      varying vec2 vUv;
      uniform float time;
      void main() 
      {
          float a = pow( bias + scale * abs(dot(vNormal, vPositionNormal)), power );
          vec4 mapColor=texture2D( textureMap, vUv*repeat);
          gl_FragColor = vec4( glowColor*mapColor.rgb, a );
      }
      `;
      return shader;
    },
    dispose: function (content) { }
  });
  return ParticlesLayer
});