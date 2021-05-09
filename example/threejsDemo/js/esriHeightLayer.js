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

  var HeightLayer = declare(null, {
    constructor: function (view, options) {
      options = options || {};
      this.view = view;
      //this.geoLayer = options.geoLayer || null;
      this.queryUrl = options.queryUrl || null;
      this.extrudeField = options.extrudeField || null;
      this.interval = options.interval || 20;
      this.labelField = options.labelField || null;
      this.maxHeight = options.maxHeight || 2000;
      this.minHeight = options.minHeight || 200;
      this.rgbArray = options.rgbArray || [255, 0, 0];
      this.defaultFont = options.defaultFont || null;
      this.HsvColor = 0;
      this.geometryArray = [];
      this.labelInfos = [];
      this.labelMeshs = [];
      this.labelRotate = false;
      this.lastHeading = this.view.camera.heading;
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
      this.HsvColor = this.rgbToHsv();
      this.getCoords(context);
      this.view.on('drag', lang.hitch(this, function (evt) {
        if (evt.action === 'end' && this.lastHeading != this.view.camera.heading) this.labelRotate = true;

      }));
      this.view.watch('extent', lang.hitch(this, function (evt) {
        if (this.lastHeading != this.view.camera.heading) this.labelRotate = true;
      }));
      // if (this.labelField) {
      //   var loader = new THREE.FontLoader();
      //   loader.load('ttf/思源宋体_Regular.json', lang.hitch(this, function (font) {
      //     this.defaultFont = font;
      //     this.getCoords(context);
      //     this.view.on('drag', lang.hitch(this, function (evt) {
      //       if (evt.action === 'end' && this.lastHeading != this.view.camera.heading) this.labelRotate = true;

      //     }));
      //     this.view.watch('extent', lang.hitch(this, function (evt) {
      //       if (this.lastHeading != this.view.camera.heading) this.labelRotate = true;
      //     }));
      //   }));

      // } else {
      //   this.getCoords(context);
      // }
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
      // this.renderer.resetGLState();
      this.renderer.state.reset();
      this.renderer.render(this.scene, this.camera);
      // as we want to smoothly animate the ISS movement, immediately request a re-render
      externalRenderers.requestRender(this.view);
      if (this.geometryArray.length > 0) {
        this.updateGeometry();
      }

      this.labelRotate && this.updateLabel();
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
          var rings = results.features[k].geometry.rings[0];//默认一个环
          var coordsArray = new Array(rings.length * 3);
          var begin = new Array(rings.length * 3);
          for (var i = 0; i < rings.length; i++) {
            begin[i * 3] = rings[i][0];
            begin[i * 3 + 1] = rings[i][1];
            begin[i * 3 + 2] = 100;
          }
          externalRenderers.toRenderCoordinates(that.view, begin, 0, that.view.spatialReference, coordsArray, 0, rings.length);

          var height = that.getHeight(results.features, results.features[k].attributes[that.extrudeField]);
          //var color = that.getColor(results.features, results.features[k].attributes[that.extrudeField]);
          var color = that.getColorByValue(results.features, results.features[k].attributes[that.extrudeField]);
          //创建注记
          var info = {};
          var center = new Array(3);
          externalRenderers.toRenderCoordinates(that.view, [results.features[k].geometry.centroid.x, results.features[k].geometry.centroid.y, 10], 0, that.view.spatialReference, center, 0, 1);
          info.center = center;
          info.attributes = results.features[k].attributes;
          that.labelInfos.push(info);
          var labelText = results.features[k].attributes[that.labelField];
          that.createLabel(center, labelText, height);
          //创建几何
          that.createGeometry(coordsArray, height, color);
        }
        context.resetWebGLState();
      });
    },
    createGeometry: function (coordsArray, height, color) {
      const shape = new THREE.Shape();//底面几何
      const lineMaterial = new THREE.LineBasicMaterial({ color: '#7c6bdd' });//轮廓线
      const linGeometry = new THREE.Geometry();
      for (var j = 0; j < coordsArray.length; j = j + 3) {
        var x = coordsArray[j];
        var y = coordsArray[j + 1];
        if (j === 0) {
          shape.moveTo(x, y);
        }
        shape.lineTo(x, y);
        linGeometry.vertices.push(new THREE.Vector3(x, y, 100 + 0.01));
      }
      const extrudeSettings = {
        depth: 10,
        bevelEnabled: false
      };
      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      const material = new THREE.MeshPhongMaterial({ color: color, transparent: true, opacity: 0.8 });
      material.castShadow = true;
      const mesh = new THREE.Mesh(geometry, material);
      const line = new THREE.Line(linGeometry, lineMaterial);
      this.geometryArray.push({ height: height, extrudeGeometry: shape, mesh: mesh, material: material });
      this.scene.add(mesh);
      //this.scene.add(line);
    },
    updateGeometry: function () {
      if (this.geometryArray.length > 0) {
        for (var k = 0; k < this.geometryArray.length; k++) {
          var geo = this.geometryArray[k];
          if (geo.mesh.geometry.parameters.options.depth < geo.height) {
            var extrudeSettings = {
              depth: geo.mesh.geometry.parameters.options.depth + this.interval,
              bevelEnabled: false
            };
            const geometry = new THREE.ExtrudeGeometry(geo.extrudeGeometry, extrudeSettings);
            const newMesh = new THREE.Mesh(geometry, geo.material);
            this.scene.remove(geo.mesh);
            this.scene.add(newMesh);
            this.geometryArray[k].mesh = newMesh;
          }
        }
      }
    },
    createLabel: function (coords, label, height) {
      var _self = this;
      if (this.labelField) {
        if (this.defaultFont) {
          var geometry = new THREE.TextGeometry(label, {
            font: this.defaultFont,
            size: 120,
            height: 50,
            curveSegments: 12,
            bevelEnabled: true,
            bevelThickness: 10,
            bevelSize: 8,
            bevelSegments: 5
          });
          //创建法向量材质
          var meshMaterial = new THREE.MeshNormalMaterial({
            flatShading: THREE.FlatShading,
            transparent: true,
            opacity: 0.9
          });
          var mesh = new THREE.Mesh(geometry, meshMaterial);
          mesh.position.set(coords[0], coords[1], height + 300);
          _self.labelMeshs.push(mesh);
          const heading = _self.view.camera.heading;
          mesh.rotateX(Math.PI / 2);//绕x轴旋转
          mesh.rotateY(-Math.PI / 180 * heading);//绕y轴旋转
          _self.scene.add(mesh);
        } else {
          var loader = new THREE.FontLoader();
          loader.load('ttf/思源宋体_Regular.json', function (font) {
            _self.defaultFont = font;
            const geometry = new THREE.TextGeometry(label, {
              font: font,
              size: 150,
              height: 50,
              curveSegments: 12,
              bevelEnabled: true,
              bevelThickness: 10,
              bevelSize: 8,
              bevelSegments: 5
            });
            //创建法向量材质
            const meshMaterial = new THREE.MeshNormalMaterial({
              flatShading: THREE.FlatShading,
              transparent: true,
              opacity: 0.9
            });
            const mesh = new THREE.Mesh(geometry, meshMaterial);
            mesh.position.set(coords[0] - 10, coords[1], height + 300);
            _self.labelMeshs.push(mesh);
            const heading = _self.view.camera.heading;
            mesh.rotateX(Math.PI / 2);//绕x轴旋转
            mesh.rotateY(-Math.PI / 180 * heading);//绕y轴旋转
            _self.scene.add(mesh);
          });
        }
      }
    },
    updateLabel: function () {
      var heading = this.view.camera.heading;
      var rotateY = 0;
      if (heading > 90 && heading < 270) {
        heading = heading - this.lastHeading;
      }
      this.lastHeading = this.view.camera.heading;
      if (this.labelMeshs.length > 0) {
        for (var i = 0; i < this.labelMeshs.length; i++) {
          if (this.lastHeading > 90 && this.lastHeading < 270)
            rotateY = -Math.PI / 180 * heading;
          else
            rotateY = -Math.PI / 180 * heading - this.labelMeshs[i].rotation.y;
          this.labelMeshs[i].rotateY(rotateY);
        }
      }
      this.labelRotate = false;
      window.labelMeshs = this.labelMeshs[0];
    },
    getColor: function (graphics, value) {
      var color = 'rgb(255,120,0)';
      if (this.extrudeField) {
        var min = parseFloat(graphics[0].attributes[this.extrudeField]);
        var max = parseFloat(graphics[0].attributes[this.extrudeField]);
        for (var k = 0; k < graphics.length; k++) {
          var num = parseFloat(graphics[k].attributes[this.extrudeField]);
          if (min >= num) {
            min = num;
          }
          if (max < num) {
            max = num;
          }
        }
        if (max - min == 0)
          color = 'rgb(255,0,0)';
        else
          color = 'rgb(255,' + parseInt((max - value) * 255 / ((max - min))) + ',0)';
      }
      console.log(color);
      return color;
    },
    getHeight: function (graphics, value) {
      var height = this.minHeight;
      const minH = this.minHeight;
      const maxH = this.maxHeight;
      if (this.extrudeField) {
        var min = parseFloat(graphics[0].attributes[this.extrudeField]);
        var max = parseFloat(graphics[0].attributes[this.extrudeField]);
        for (var k = 0; k < graphics.length; k++) {
          var num = parseFloat(graphics[k].attributes[this.extrudeField]);
          if (min >= num) {
            min = num;
          }
          if (max < num) {
            max = num;
          }
        }
        if (max - min == 0)
          height = minH;
        else
          height = minH + parseInt((value - min) / (max - min) * (maxH - minH))
      }
      return height;
    },
    produceColor: function (data) {
      var colorArr = [];
      for (var i = 0; i < data.length; i++) {
        colorArr[i] = [];
        for (var j = 0; j < data[i].length; j++) {
          if ((data[i][j] - this.minValue) <= (this.maxValue - this.minValue) / 2) {
            colorArr[i][j] = [(data[i][j] - this.minValue) * 255 / ((this.maxValue - this.minValue) / 2), 255, 0]
          } else {
            colorArr[i][j] = [255, (this.maxValue - data[i][j]) * 255 / ((this.maxValue - this.minValue) / 2), 0]
          }
        }
      }
      return colorArr
    },
    getColorByValue: function (graphics, value) {
      var color = 'rgb(' + this.rgbArray[0] + ',' + this.rgbArray[1] + ',' + this.rgbArray[2] + ')';
      var _self = this;
      var valueArray = [];
      if (this.extrudeField) {
        for (var k = 0; k < graphics.length; k++) {
          valueArray.push(graphics[k].attributes[this.extrudeField]);
        }
        valueArray.sort(function (a, b) {
          return a - b;
        });
        for (var l = 0; l < valueArray.length; l++) {
          var num = valueArray[l];
          if (num == value) {
            var rgbArr = _self.hsvToRgb([_self.HsvColor[0], (l + 1) * (1 / valueArray.length * 100), 100]);
            color = 'rgb(' + rgbArr[0] + ',' + rgbArr[1] + ',' + rgbArr[2] + ')';
            break;
          }
        }
      }
      console.log(color);
      return color;
    },
    rgbToHsv: function (arr) {
      var arr = this.rgbArray.concat();
      var h = 0, s = 0, v = 0;
      var r = arr[0], g = arr[1], b = arr[2];
      arr.sort(function (a, b) {
        return a - b;
      })
      var max = arr[2]
      var min = arr[0];
      v = max / 255;
      if (max === 0) {
        s = 0;
      } else {
        s = 1 - (min / max);
      }
      if (max === min) {
        h = 0;
      } else if (max === r && g >= b) {
        h = 60 * ((g - b) / (max - min)) + 0;
      } else if (max === r && g < b) {
        h = 60 * ((g - b) / (max - min)) + 360
      } else if (max === g) {
        h = 60 * ((b - r) / (max - min)) + 120
      } else if (max === b) {
        h = 60 * ((r - g) / (max - min)) + 240
      }
      h = parseInt(h);
      s = parseInt(s * 100);
      v = parseInt(v * 100);
      return [h, s, v]
    },
    hsvToRgb: function (arr) {
      var h = arr[0], s = arr[1], v = arr[2];
      s = s / 100;
      v = v / 100;
      var r = 0, g = 0, b = 0;
      var i = parseInt((h / 60) % 6);
      var f = h / 60 - i;
      var p = v * (1 - s);
      var q = v * (1 - f * s);
      var t = v * (1 - (1 - f) * s);
      switch (i) {
        case 0:
          r = v; g = t; b = p;
          break;
        case 1:
          r = q; g = v; b = p;
          break;
        case 2:
          r = p; g = v; b = t;
          break;
        case 3:
          r = p; g = q; b = v;
          break;
        case 4:
          r = t; g = p; b = v;
          break;
        case 5:
          r = v; g = p; b = q;
          break;
        default:
          break;
      }
      r = parseInt(r * 255.0);
      g = parseInt(g * 255.0);
      b = parseInt(b * 255.0);
      return [r, g, b];
    },
    dispose: function (content) { }
  });
  return HeightLayer
});