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
      this.pointLight = new THREE.PointLight(0xffffff, 1);
      this.camera.add(this.pointLight);
      this.sun = new THREE.DirectionalLight(0xffffff, 0.5);
      this.sun.position.set(-600, 300, 60000);
      this.scene.add(this.sun);

      // this.renderScene = new THREE.RenderPass(this.scene, this.camera);
      // this.composer = new THREE.EffectComposer(this.renderer);
      // this.composer.addPass(this.renderScene);
      // this.outlineObjs = [];
      // var outlinePass = new THREE.OutlinePass(new THREE.Vector2(this.view.width, this.view.height), this.scene, this.camera);
      // outlinePass.renderToScreen = true;
      // outlinePass.selectedObjects = this.outlineObjs;
      // this.composer.addPass(outlinePass);
      // var params = {
      //   edgeStrength: 8,
      //   edgeGlow: 1,
      //   edgeThickness: 4,
      //   pulsePeriod: 0,
      //   usePatternTexture: false
      // };

      // outlinePass.edgeStrength = params.edgeStrength;
      // outlinePass.edgeGlow = params.edgeGlow;
      // outlinePass.visibleEdgeColor.set('#2d95f2');
      // outlinePass.hiddenEdgeColor.set('#00a4ff');

      this.clock = new THREE.Clock(); //时间跟踪

      // this.bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(this.view.width, this.view.height), 1.5, 0.4, 0.85);
      // this.bloomPass.threshold = 0;
      // this.bloomPass.strength = 0.35;
      // this.bloomPass.radius = 0;

      // var renderTarget = new THREE.WebGLRenderTarget(this.view.width, this.view.height);
      // this.composer = new THREE.EffectComposer(this.renderer, renderTarget);
      // this.composer.addPass(this.renderScene);
      // this.composer.addPass(this.bloomPass);

      // this.composer.render();

      //var geometrys = this.getCoords(context);
      //var canvas = this.produceCanvas();

      this.getCoords(context);
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
      //this.composer.renderer.clear();

      this.renderer.render(this.scene, this.camera);
      // var delta = this.clock.getDelta();
      // this.composer.render(delta);

      // // as we want to smoothly animate the ISS movement, immediately request a re-render
      externalRenderers.requestRender(this.view);
      // // cleanup
      context.resetWebGLState();
    },
    getCoords: function (context) {
      var queryTask = new QueryTask({
        url: "https://esrichina3d.arcgisonline.cn/arcgis/rest/services/Hosted/shanghaishp/FeatureServer/0"
      });
      var query = new Query();
      query.returnGeometry = true;
      query.outFields = ["*"];
      query.where = "1=1";
      var that = this;
      queryTask.execute(query).then(function (results) {
        console.log(results.features);
        for (var k = 0; k < results.features.length; k++) {
          var rings = results.features[k].geometry.rings[0];//默认一个环
          var coordsArray = new Array(rings.length * 3);
          var begin = new Array(rings.length * 3);
          for (var i = 0; i < rings.length; i++) {
            begin[i * 3] = rings[i][0];
            begin[i * 3 + 1] = rings[i][1];
            begin[i * 3 + 2] = 100;
          }
          externalRenderers.toRenderCoordinates(that.view, begin, 0, that.view.spatialReference, coordsArray, 0, rings.length);
          if (k == 5) {
            //创建几何
            that.createGeometry(coordsArray);
            break;
          }
        }
        context.resetWebGLState();
      });
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
        depth: 0.5,
        bevelEnabled: false
      };
      var customMaterial = new THREE.ShaderMaterial(
        {
          uniforms:
            {
              "c": { type: "f", value: 1.0 },
              "p": { type: "f", value: 2.3 },
              glowColor: { type: "c", value: new THREE.Color("#00ffc3") },
              viewVector: { type: "v3", value: this.camera.position }
            },
          vertexShader: document.getElementById('vertexShader').textContent,
          fragmentShader: document.getElementById('fragmentShader').textContent,
          side: THREE.FrontSide,
          blending: THREE.AdditiveBlending,
          transparent: true
        });
      var resolution = new THREE.Vector2(this.view.width, this.view.height);
      var MeshLineMaterial = new MeshLineMaterial({
        useMap: false,
        color: new THREE.Color("#00ffc3"),
        opacity: 0,
        transparent: true,
        dashArray: 0,
        resolution: resolution,
        sizeAttenuation: false,
        lineWidth: 105,
        near: this.camera.near,
        far: this.camera.far,
      })
      var geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      //var geometry = new THREE.ShapeGeometry(shape);
      this.assignUVs(geometry);
      const material = new THREE.MeshPhongMaterial({ color: '#7c6bdd', transparent: true, opacity: 0.8 });
      // material.castShadow = true;
      const mesh = new THREE.Mesh(geometry, this._getMaterial());
      const line = new THREE.Line(linGeometry, MeshLineMaterial);
      var canvas = this.getCanvas();
      var texture = new THREE.CanvasTexture(canvas);
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.y = -1;
      var ground = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({
        map: texture,
        side: THREE.DoubleSide,
        // 透明度设置 0921
        wireframe: false,
        opacity: 1,
        transparent: true
      }));
      //this.scene.add(ground);
      //this.outlineObjs.push(mesh);
      //this.scene.add(mesh);
      this.scene.add(line);
    },
    getCanvas: function () {
      var canvas = document.createElement("canvas");
      var context = canvas.getContext("2d");
      var width = this.view.width;
      var height = this.view.height;
      canvas.setAttribute('width', width);
      canvas.setAttribute('height', height);
      var centerX = width / 2
      var centerY = height / 2
      context.beginPath();
      // context.arc(100, 100, 50, 0, 360, false)
      var lingrad = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, centerX)  //参数分别为 内圆x坐标,y坐标,半径,外圆x坐标,y坐标,半径
      lingrad.addColorStop(0, '#0e1c27')      //addColorStop()设置渐变范围及颜色
      lingrad.addColorStop(0.9, '#02cf99')
      lingrad.addColorStop(1, '#02cf99')//23253c

      // console.log(width,height,centerX,centerY)
      context.fillStyle = lingrad
      context.fillRect(0, 0, width, height)
      // context.stroke()
      return canvas;
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

    getGeometry: function (context) {
      var cenP = [];
      externalRenderers.toRenderCoordinates(this.view, this.position, 0, this.view.spatialReference, cenP, 0, 1);
      var geometry = new THREE.CylinderGeometry(150, 150, 1, 60, 60);
      var material = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, blending: THREE.MultiplyBlending });
      this.material = this.getMaterial();
      var mesh = new THREE.Mesh(geometry.clone(), this.material);
      mesh.position.set(cenP[0], cenP[1], cenP[2]);
      mesh.rotateX(Math.PI / 2);
      let size = 0.3;
      mesh.scale.set(size, size, size)
      this.scene.add(mesh);
    },
    _getMaterial: function () {
      var vertexShader = [
        'varying vec3 vNormal;',
        'void main()',
        '{',
        'vNormal = normalize(normalMatrix * normal);',
        'gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
      ].join('\n');
      var fragmentShader2 = [
        'uniform float c;',
        'uniform float p;',
        'varying vec3 vNormal;',
        'void main()',
        '{',
        'float intensity = pow(c - dot(vNormal, vec3(0.0, 0.0, 1.0)), p);',
        'gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0) * intensity;',
        '}'
      ].join('\n');
      let material = new THREE.ShaderMaterial({
        fragmentShader: fragmentShader2,
        vertexShader: vertexShader,
        uniforms: {
          "c": {
            type: "f",
            value: 2
          },
          "p": {
            type: "f",
            value: 2
          }
        },
        depthWrite: false,
        side: THREE.BackSide
      });
      return material;
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
    getMaterial2: function () {
      var uniform = {
        u_color: { value: new THREE.Color('#5588aa') },//new THREE.Color("#5588aa")5588aa
        u_tcolor: { value: new THREE.Color("#ff9800") },
        u_r: { value: 0.25 },
        u_length: { value: 1000 },//扫过区域
        u_max: { value: 15000 }//扫过最大值
      };
      var Shader = {
        vertexShader: ` 
            varying vec3 vp;
            void main(){
            vp = position; 
            gl_Position	= projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying vec3 vp;
            uniform vec3 u_color;
            uniform vec3 u_tcolor;
            uniform float u_r;
            uniform float u_length;
            uniform float u_max;
            float getLeng(float x, float y){
                return  sqrt((x-0.0)*(x-0.0)+(y-0.0)*(y-0.0));
            }
            void main(){ 
                float uOpacity = 0.0001; 
                vec3 vColor = u_color;
                float uLength = getLeng(vp.x,vp.z);
                if ( uLength <= u_r && uLength > u_r - u_length ) { 
                    float op = sin( (u_r - uLength) / u_length ) * 0.6 + 0.3 ;
                    uOpacity = op; 
                    if( vp.y<0.0){
                        vColor  = u_tcolor * 0.6; 
                    }else{ 
                        vColor = u_tcolor;
                    };
                } 
                gl_FragColor = vec4(vColor,uOpacity);
            }
        `
      }

      let material = new THREE.ShaderMaterial({
        vertexShader: Shader.vertexShader,
        fragmentShader: Shader.fragmentShader,
        side: THREE.DoubleSide,
        uniforms: uniform,
        transparent: true,
        depthWrite: false,
      });
      return material;
    },
    getShaderStr2: function () {
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