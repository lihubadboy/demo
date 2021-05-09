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

  var BloomBdLayer = declare(null, {
    constructor: function (view, options) {
      options = options || {};
      this.view = view;
      this.queryUrl = options.queryUrl || '';
      this.height = options.height || 1000;
      this.radius = options.radius || 5000;
      this.center = options.position || [0, 0, 0];
      this.uniforms = [];
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


      // this.bloomPass = new THREE.BloomPass(2, 25, 4.0, 256); //BloomPass通道效果
      // this.renderScene = new THREE.RenderPass(this.scene, this.camera);
      // this.renderScene.clear = false;
      // var renderTarget = new THREE.WebGLRenderTarget(this.view.width, this.view.height);
      // const effectCopy = new THREE.ShaderPass(THREE.CopyShader); //传入了CopyShader着色器，用于拷贝渲染结果
      // effectCopy.renderToScreen = true;
      // this.composer = new THREE.EffectComposer(this.renderer, renderTarget);
      // this.composer.setSize(this.view.width, this.view.height);
      // this.composer.addPass(this.renderScene);
      // this.composer.addPass(this.bloomPass);
      // this.composer.addPass(effectCopy);
      // this.composer.render();

      this.uniform = {
        boxH: { value: this.height },
        vColor: { value: new THREE.Color('#4d4aea') },
      };

      var _self = this;
      var img = new Image()
      img.src = "images/circle.png";
      img.onload = function () {
        var texture = new THREE.CanvasTexture(_self.produceCanvas(img));
        texture.needsUpdate = true;
        var geometry = new THREE.CircleGeometry(_self.radius, 300, Math.PI, 2 * Math.PI);
        _self.ground = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({
          map: texture,
          opacity: 1,
          transparent: true
        }));
        var cenP = [];
        externalRenderers.toRenderCoordinates(_self.view, _self.center, 0, _self.view.spatialReference, cenP, 0, 1);
        _self.ground.position.set(cenP[0], cenP[1], cenP[2]);
        _self.scene.add(_self.ground);
      }

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
      // if (this.uniforms.length > 0) {

      // }
      if (this.uniform) {
        this.uniform.boxH.value += 150;
        if (this.uniform.boxH.value > 8000) {
          this.uniform.boxH.value = 5000.0
        }
      }
      if (this.ground) {
        this.ground.rotation.z += 0.05;
        if (this.ground.rotation.z > 2 * Math.PI) {
          this.ground.rotation.z = 0;
        }
      }
      this.renderer.state.reset();
      this.renderer.render(this.scene, this.camera);


      // 请求重绘视图。
      externalRenderers.requestRender(view);
      // cleanup
      context.resetWebGLState();
    },
    produceCanvas: function (img) {
      var canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      var ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, 512, 512);
      ctx.beginPath();
      ctx.strokeStyle = "rgb(128, 128, 128)";
      ctx.lineWidth = 1;
      ctx.arc(256, 256, 250, 0, Math.PI * 2, true);
      ctx.stroke();
      ctx.save();
      ctx.translate(256, 256);
      ctx.rotate(30 / 180.0 * Math.PI);
      ctx.translate(-256, -256);
      ctx.drawImage(img, 0, 0);
      ctx.restore();
      return canvas;
    },
    produceCanvas_line: function () {
      var canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      var ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, 256, 256);
      var linearGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      var gradient = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, canvas.width / 2);
      gradient.addColorStop(0, "rgba(0,236, 183, 0.9)");
      gradient.addColorStop(0.2, "rgba(0,236, 183, 0.7 )");
      gradient.addColorStop(0.4, "rgba(0,236, 183, 0.6 )");
      gradient.addColorStop(0.6, "rgba(0,236, 183, 0.5 )");
      gradient.addColorStop(0.8, "rgba(0,236, 183, 0.3 )");
      gradient.addColorStop(1, "rgba(0,236, 183, 0 )");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return canvas;
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
          if (k > 15) {
            var rings = results.features[k].geometry.rings[0];//默认一个环
            var centerP = results.features[k].geometry.centroid;
            var coordsArray = new Array(rings.length * 3);
            var begin = new Array(rings.length * 3);
            for (var i = 0; i < rings.length; i++) {
              begin[i * 3] = rings[i][0];
              begin[i * 3 + 1] = rings[i][1];
              begin[i * 3 + 2] = 100;
            }
            var cenP = [];
            externalRenderers.toRenderCoordinates(that.view, begin, 0, that.view.spatialReference, coordsArray, 0, rings.length);
            externalRenderers.toRenderCoordinates(that.view, [centerP.x, centerP.y, centerP.z], 0, that.view.spatialReference, cenP, 0, 1);
            //创建拉伸建筑
            that.createGeometry(coordsArray, cenP, context);
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
    createGeometry: function (coordsArray, cenP, context) {
      const shape = new THREE.Shape();//底面几何
      const lineMaterial = new THREE.LineBasicMaterial({ color: '#00ecb7', linewidth: 10 });//轮廓线
      //创建线
      var texture_polygon = new THREE.TextureLoader().load("images/test-4.png");
      texture_polygon.wrapT = THREE.RepeatWrapping;
      var material_polygon = new THREE.MeshPhongMaterial({
        map: new THREE.CanvasTexture(this.produceCanvas_line()),
        side: THREE.FrontSide,
        blending: THREE.AdditiveBlending,
      });
      let vecPoint = [];
      const linGeometry = new THREE.Geometry();
      for (var j = 0; j < coordsArray.length; j = j + 3) {
        var x = coordsArray[j];
        var y = coordsArray[j + 1];
        if (j === 0) {
          shape.moveTo(x, y);
        }
        shape.lineTo(x, y);
        linGeometry.vertices.push(new THREE.Vector3(x, y, 100));
        vecPoint.push({ x, y })
      }
    
      const extrudeSettings = {
        depth: this.height,
        bevelEnabled: false
      };
      var geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      var geometry2 = new THREE.ShapeGeometry(shape);
      this.assignUVs(geometry);
      this.assignUVs(geometry2);
      var material = new THREE.MeshPhongMaterial({ color: new THREE.Color('#4d4aea'), transparent: true, opacity: 1 });
      var mesh = new THREE.Mesh(geometry, this.getMaterial_outline());
      this.scene.add(mesh);
      var geo = new THREE.EdgesGeometry(geometry);
      var mat = new THREE.LineBasicMaterial({ color: new THREE.Color('#00ffff') });
      var wireframe = new THREE.LineSegments(geo, mat);
      this.scene.add(wireframe);
    },
    //建筑材质
    getMaterial_bd: function () {
      let shader = this.getShaderStr_bd();
      let material = new THREE.ShaderMaterial({
        uniforms: this.uniform,
        vertexShader: shader.vs,
        fragmentShader: shader.fs,
        transparent: true,
        depthTest: false,
        side: THREE.DoubleSide,
      });
      material.needsUpdate = true
      return material;
    },
    getShaderStr_bd: function () {
      let shader = { vs: '', fs: '' };
      // var vertexShader = [
      //   'varying vec3 vColor;',
      //   'varying vec3	vVertexNormal;',
      //   "varying vec2 vUv;",
      //   'varying float v_pz; ',
      //   'void main(){',
      //   ' v_pz = position.y; ',   //获取顶点位置的y
      //   '	vVertexNormal	= normal;', //顶点法向量
      //   '	gl_Position	= projectionMatrix * modelViewMatrix * vec4(position, 1.0);',//顶点位置
      //   '}'
      // ].join('\n')
      // var fragmentShader = [
      //   'uniform float	boxH;',        //立方体高度，uniform传入
      //   'varying vec3	vVertexNormal;',  //顶点法向量，由顶点着色器传入--插值
      //   'uniform vec3 vColor;',       //顶点颜色，由顶点着色器传入--插值
      //   "varying vec2 vUv;",         //纹理坐标，顶点着色器传入
      //   'varying float v_pz; ',      //y的值，顶点着色器传入
      //   'float plot ( float pct){',//pct是box的高度，v_pz是y的值
      //   'return  smoothstep( pct-8.0, pct, v_pz) -',  //（smoothstep(edge1,edge2,x)）smoothstep函数定义从0到1之间由edge1和edge2上下边界，x为输入值，返回插值
      //   'smoothstep( pct, pct+0.02, v_pz);',   //不在0-1范围内的数会被归一化到0和1内，越界会被设为0/1
      //   '}',
      //   'void main(){',
      //   'float f1 = plot(boxH);',    //以当前盒子的高度（光效），和y的值计算出颜色
      //   'vec4 b1 = mix(vec4(1.0,1.0,1.0,1.0),vec4(f1,f1,f1,1.0),0.8);',
      //   'gl_FragColor = mix(vec4(vColor,1.0),b1,f1);',//混合两种颜色
      //   'gl_FragColor = vec4(gl_FragColor.r,gl_FragColor.g,gl_FragColor.b,0.6);',//重新设置片元颜色
      //   '}'
      // ].join('\n');

      var vertexShader = `
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vPositionNormal;
      varying vec2 vUv;
      void main() {
        //将attributes的normal通过varying赋值给了向量vNormal
        vNormal = normal;
        vPosition = position;
        //projectionMatrix是投影变换矩阵 modelViewMatrix是相机坐标系的变换矩阵
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, position.y, position.z, 1.0);
      }
      `;
      var fragmentShader = `
      varying vec3 vNormal;
      varying vec3 vPosition;
      uniform float	boxH;
      void main() {
        float cy = (fract((vPosition.z - boxH) / boxH) + 0.8) * 0.8;
        if (vNormal.x == 0.0 && vNormal.y == 1.0 && vNormal.z == 0.0) {
          cy = 1.0;
        }
        gl_FragColor = vec4(0.0, cy, cy, 1.0);
      }
      `;
      shader.vs = vertexShader;

      shader.fs = fragmentShader;
      return shader;
    },
    //
    getMaterial_outline: function (uv) {
      this._uniforms2 = {
        _Color: {
          value: new THREE.Color('#00ffff') //材质本身颜色
        },
        _AtmoColor: {
          value: new THREE.Color(0, 0, 0, 0) //光晕颜色
        },
        _Size: {
          value: 0.1
        },
        _OutLightPow: {
          value: 2.0
        },
        _OutLightStrength: {
          value: 15.0
        }
      }
      let shader = this.getShaderStr_outline();
      let material = new THREE.ShaderMaterial({
        uniforms: this._uniforms2,
        vertexShader: shader.vs,
        fragmentShader: shader.fs,
        transparent: true,
        depthTest: false,
        side: THREE.DoubleSide,
      });
      return material;
    },
    getShaderStr_outline: function () {
      let shader = { vs: '', fs: '' };

      shader.vs = ` 
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vPositionNormal;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vNormal = normalize( normalMatrix * normal ); // 转换到视图空间
        vPosition = position;
        vPositionNormal = normalize(( modelViewMatrix * vec4(position, 1.0) ).xyz);
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }
      `;

      shader.fs = `
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec3 vPositionNormal;
      uniform vec3 _Color;
      uniform float _OutLightPow;
      void main() {
		  	float a = pow(1.0 - abs(dot(vNormal, vPositionNormal)), _OutLightPow );
        gl_FragColor = vec4(_Color, a );
      }
      `;
      return shader;
    },
    getMaterial: function () {
      this._uniforms = {
        time: {
          value: 0.0 //时间
        },
        baseColor: {
          value: new THREE.Color(0, 0.1, 0.6) //材质本身颜色
        },
        _FlashColor: {
          value: new THREE.Color(1, 1, 1) //闪光条的光颜色
        },
        _Angle: {
          value: 45.0 // 闪光条的角度，范围是0到180°
        },
        _Width: {
          value: 0.0000000000000001 // 闪光条宽度，范围是0到1.0
        }
      }
      let shader = this.getShaderStr();
      let material = new THREE.ShaderMaterial({
        uniforms: this._uniforms,
        vertexShader: shader.vs,
        fragmentShader: shader.fs,
        transparent: true,
        depthTest: false,
        side: THREE.DoubleSide,
      });
      return material;
    },
    getShaderStr: function () {
      let shader = { vs: '', fs: '' };

      shader.vs = ` 
      varying vec3 vPosition;
      varying vec2 vUV;
        void main() {
            vUV = uv;
            vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
            gl_Position = projectionMatrix * mvPosition;
      }
      `;

      shader.fs = `
      uniform float time;
      uniform vec3 _FlashColor;
      uniform vec3 baseColor;
      uniform float _Angle;
      uniform float _Width;
      varying vec2 vUV;
      float inFlash(vec2 uv)
      {	
          float brightness = 0.0;
          float angleInRad = 0.0174444 * _Angle;
          float tanInverseInRad = 1.0 / tan(angleInRad);        
          bool onLeft = (tanInverseInRad > 0.0);
          float xBottomFarLeft = onLeft? 0.0 : tanInverseInRad;
          float xBottomFarRight = onLeft? (1.0 + tanInverseInRad):1.0;
          float percent =time;
          float xBottomRightBound = xBottomFarLeft + percent * (xBottomFarRight - xBottomFarLeft);
          float xBottomLeftBound = xBottomRightBound - _Width;
          float xProj = uv.x + uv.y * tanInverseInRad;
          if(xProj > xBottomLeftBound && xProj < xBottomRightBound)
          {
                brightness = 1.0 - abs(2.0 * xProj - (xBottomLeftBound + xBottomRightBound)) / _Width;
          }
          return brightness;
      }
      void main() {
          //vec2 tempUV=vUV;
          float brightness = inFlash(vUV);
          gl_FragColor.rgb = baseColor.rgb*1.2 + _FlashColor.rgb * brightness;
          gl_FragColor.a=1.0;
      }`;
      return shader;
    },
    dispose: function (content) { }
  });
  return BloomBdLayer
});