/* ------------------------------------------------------------

   Copyright 2016 Esri

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at:
   http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.

--------------------------------------------------------------- */

define([
  'esri/core/declare',
  'esri/geometry/Point',
  'esri/geometry/SpatialReference',
  'esri/views/3d/externalRenderers',
  'esri/geometry/support/webMercatorUtils',
], function(declare, Point, SpatialReference, externalRenderers, webMercatorUtils) {
  // Enforce strict mode
  'use strict';

  // Constants
  var THREE = window.THREE;
  var RADIUS = 6378137;
  var OFFSET = 5000;
  //   var COLOR = 0xffffff;
  var COLOR = 0xef6c00; //0x00ffff;
  var REST = 75; //ms
  // var REST = 200;

  const RandomColors = [
    // '#1A93D3',
    // '#B5C334',
    // '#C1232B',
    // '#E87C25',
    // '#27727B',
    // '#FE8463',
    // '#9BCA63',
    // '#FAD860',
    // '#F3A43B',
    // '#60C0DD',
    // '#D7504B',
    // '#C6E579',
    // '#F4E001',
    // '#F0805A',
    // '#26C0C0',
    // '#c23531',
    '#00FFFF',
    '#00FF00',
    // '#2f4554',
    // '#61a0a8',
    // '#d48265',
    // '#91c7ae',
    // '#749f83',
    // '#ca8622',
    // '#bda29a',
    // '#6e7074',
    // '#546570',
    // '#c4ccd3',
  ];

  var colorindex = 0;
  function getColor() {
    if (colorindex === 0) {
      colorindex = 1;
    } else {
      colorindex = 0;
    }
    return RandomColors[colorindex].replace('#', '0x');
  }

  return declare([], {
    constructor: function(view, tracks) {
      this.view = view;
      this.tracks = tracks;
      this.index = 0;
      this.max = 0;

      this.meshLines = [];
      this.refresh = Date.now();
    },
    setup: function(context) {
      // Create the THREE.js webgl renderer
      this.renderer = new THREE.WebGLRenderer({
        context: context.gl,
        premultipliedAlpha: false,
      });
      this.renderer.setPixelRatio(window.devicePixelRatio);
      this.renderer.setViewport(0, 0, this.view.width, this.view.height);

      // Make sure it does not clear anything before rendering
      this.renderer.autoClear = false;
      this.renderer.autoClearDepth = false;
      this.renderer.autoClearColor = false;
      this.renderer.autoClearStencil = false;

      // The ArcGIS JS API renders to custom offscreen buffers, and not to the default framebuffers.
      // We have to inject this bit of code into the three.js runtime in order for it to bind those
      // buffers instead of the default ones.
      var originalSetRenderTarget = this.renderer.setRenderTarget.bind(this.renderer);
      this.renderer.setRenderTarget = function(target) {
        originalSetRenderTarget(target);
        if (target == null) {
          context.bindRenderTarget();
        }
      };

      this.scene = new THREE.Scene();
      // setup the camera
      this.camera = new THREE.PerspectiveCamera();

      // Create lights that will resemble the sun light lighting that we do internally
      this._createLights();

      // Create objects and add them to the scene
      this._createObjects();

      // Set starting geometries
      this._updateObjects();

      // cleanup after ourselfs
      context.resetWebGLState();
    },
    render: function(context) {
      // Make sure to reset the internal THREE.js state
      this.renderer.resetGLState();

      // Update the THREE.js camera so it's synchronized to our camera
      this._updateCamera(context);

      // Update the THREE.js lights so it's synchronized to our light
      this._updateLights(context);

      // Advance current geometry
      this._updateObjects(context);

      // Render the scene
      this.renderer.render(this.scene, this.camera);

      // Immediately request a new redraw
      externalRenderers.requestRender(this.view);

      // cleanup
      context.resetWebGLState();
    },
    dispose: function(content) {},
    _createObjects: function() {
      //
      var scope = this;
      var transform = new THREE.Matrix4();

      scope.tracks.forEach(function(track) {
        // Smooth and densify line

        var curve = new THREE.SplineCurve(
          track.map(function(e) {
            const lonlat = webMercatorUtils.xyToLngLat(e[0], e[1]);

            return new THREE.Vector2(lonlat[0], lonlat[1]);
          })
        );
        // var smooth = curve.getSpacedPoints(curve.points.length * 2);
        var smooth = curve.getSpacedPoints(60);

        // Convert vectors to Esri webgl cartesian
        var smooth3d = smooth.map(function(e) {
          //   // Convert lat/long to radians
          //   var lon = (e.x * Math.PI) / 180 - Math.PI;
          //   var lat = (e.y * Math.PI) / 180 - Math.PI / 2;

          //   // Create vector to current
          //   var q = new THREE.Vector3(RADIUS + OFFSET, 0, 0);
          //   q.applyAxisAngle(new THREE.Vector3(0, 1, 0), lat);
          //   q.applyAxisAngle(new THREE.Vector3(0, 0, 1), lon);

          //   // Return vector
          //   return new THREE.Vector3(q.x, q.y, q.z);

          const mercatorPoint = webMercatorUtils.geographicToWebMercator(new Point({
            x: e.x,
            y: e.y,
            z: 10
          }));

          transform.fromArray(
            externalRenderers.renderCoordinateTransformAt(
              scope.view,
              [mercatorPoint.x, mercatorPoint.y, mercatorPoint.z],
              SpatialReference.WebMercator,
              new Array(16)
            )
          );
          return new THREE.Vector3(
            transform.elements[12],
            transform.elements[13],
            transform.elements[14]
          );
        });

        // Get the length of the longest track
        scope.max = Math.max(scope.max, smooth3d.length);

        // Create a random offset. Used to stagger animations.
        var offset = Math.floor(Math.random() * (smooth3d.length - 1));
        var color1 = Number(getColor());
        var resolution = new THREE.Vector2(window.innerWidth, window.innerHeight);

        for (var i = 0; i < smooth3d.length - 1; i++) {
          // Create line geometry
          var geometry = new THREE.Geometry();
          geometry.vertices = [smooth3d[i], smooth3d[i + 1]];

          // Create line material
          // var material = new THREE.LineBasicMaterial({
          //   color: COLOR,
          //   opacity: 0,
          //   transparent: true
          // });

          // Create line.
          // var line = new THREE.Line(geometry, material);
          // line.visible = false;
          // line.flag = i;
          // line.offset = offset;

          var g = new MeshLine();
          g.setGeometry(geometry);

          var line = new window.THREE.Mesh(
            g.geometry,
            new MeshLineMaterial({
              useMap: false,
              color: new THREE.Color(color1),
              opacity: 0,
              transparent: true,
              dashArray: 0,
              resolution: resolution,
              sizeAttenuation: false,
              lineWidth: 105,
              near: scope.camera.near,
              far: scope.camera.far,
            })
          );
          line.visible = false;
          line.flag = i;
          line.offset = offset;

          // Add line
          scope.scene.add(line);
          scope.meshLines.push(line);
        }
      });

      // Clear tracks array
      this.tracks = null;
    },
    _createLights: function() {
      // setup scene lighting
      this.ambient = new THREE.AmbientLight(0xffffff, 0.5);
      this.scene.add(this.ambient);
      this.sun = new THREE.DirectionalLight(0xffffff, 0.5);
      this.scene.add(this.sun);
    },
    _updateCamera: function(context) {
      // update camera parameters
      ///////////////////////////////////////////////////////////////////////////////////
      var cam = context.camera;

      this.camera.position.set(cam.eye[0], cam.eye[1], cam.eye[2]);
      this.camera.up.set(cam.up[0], cam.up[1], cam.up[2]);
      this.camera.lookAt(new THREE.Vector3(cam.center[0], cam.center[1], cam.center[2]));

      // Projection matrix can be copied directly
      this.camera.projectionMatrix.fromArray(cam.projectionMatrix);
    },
    _updateLights: function(context) {
      var l = context.sunLight;
      this.sun.position.set(l.direction[0], l.direction[1], l.direction[2]);
      this.sun.intensity = l.diffuse.intensity;
      this.sun.color = new THREE.Color(l.diffuse.color[0], l.diffuse.color[1], l.diffuse.color[2]);

      this.ambient.intensity = l.ambient.intensity;
      this.ambient.color = new THREE.Color(
        l.ambient.color[0],
        l.ambient.color[1],
        l.ambient.color[2]
      );
    },
    _updateObjects: function(context) {
      // Only update shapes every ~75ms
      var now = Date.now();
      if (now - this.refresh < REST) {
        return;
      }
      this.refresh = now;

      // Loop for every shape
      var scope = this;
      this.meshLines.forEach(function(e) {
        // Ignore other shapes

        // Create a new offset index
        var index = scope.index + e.offset;
        if (index > scope.max) {
          index -= scope.max;
        }

        // Show or hide a line segment
        if (e.flag - index >= 0 && e.flag - index <= 10) {
          // Slowly fade in a new line.
          var fade = 1;
          switch (index) {
            case 0:
              fade = 0.1;
              break;
            case 1:
              fade = 0.2;
              break;
            case 2:
              fade = 0.5;
              break;
          }
          // if (index > 0 && index < 1) {
          //   fade = 0.1;
          // } else if (index > 1 && index < 2) {
          //   fade = 0.2;
          // } else if (index > 2 && index < 3) {
          //   fade = 0.5;
          // }

          // Show the line segment.
          e.material.opacity = (fade * (e.flag - index)) / 10;
          e.visible = true;
        } else {
          // Hide the line segment.
          e.visible = false;
          e.material.opacity = 0;
        }
      });

      // Increment the drawing index
      this.index++;
      // this.index += 0.2;
      if (this.index >= this.max) {
        this.index = 0;
      }
    },
  });
});
