var ParticleSystems = function (THREE, scene, camera) {

	var self = this;

	var particleSystems = [];

	function initparticleSystems(length, color) {

		var materials = [];


		var material = new THREE.SpriteMaterial({

			map: new THREE.CanvasTexture(createParticleCanvas([
				{
					stop: 0,
					color: `rgba( ${color[0]}, ${color[1]}, ${color[2]}, 1 )`
				},
				{
					stop: 0.2,
					color: `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.5 )`
				},
				{
					stop: 0.4,
					color: `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.5 )`
				},
				{
					stop: 0.6,
					color: 'rgba( 0, 64, 0, 0.6  )'
				},
				{
					stop: 1,
					color: 'rgba( 0, 0, 0, 0)'
				}
			])),

			blending: THREE.AdditiveBlending

		});

		materials.push(material);

		// gradient.addColorStop( 0, 'rgba(255,255,255,1)' );
		// 		gradient.addColorStop( 0.2, 'rgba(0,255,255,1)' );
		// 		gradient.addColorStop( 0.4, 'rgba(0,0,64,1)' );
		// 		gradient.addColorStop( 1, 'rgba(0,0,0,1)' );

		var material = new THREE.SpriteMaterial({

			map: new THREE.CanvasTexture(createParticleCanvas([
				{
					stop: 0,
					color: `rgba( ${color[0]}, ${color[1]}, ${color[2]}, 1 )`
				},
				{
					stop: 0.2,
					color: `rgba(${color[0]}, ${color[1]}, ${color[2]}, 1 )`
				},
				{
					stop: 0.4,
					color: 'rgba( 0, 0, 64, 1 )'
				},
				{
					stop: 1,
					color: 'rgba( 0, 0, 0, 1 )'
				}
			])),

			blending: THREE.AdditiveBlending,
		});

		//materials.push(material);

		for (var i = 0; i < 200; i++) {

			var particleArr = {
				available: true,
				particles: []
			};

			for (var j = 0; j < length; j++) {

				var particle = new THREE.Sprite(materials[0]);
				particle.pos = 0;
				particle.visible = true;
				particleArr.particles.push(particle);
				scene.add(particle);

			}

			particleSystems.push(particleArr);

		}
	}

	function createParticleCanvas(colorArr) {

		var canvas = document.createElement('canvas');
		canvas.width = 16;
		canvas.height = 16;
		var context = canvas.getContext('2d');
		var gradient = context.createRadialGradient(canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, canvas.width / 2);

		colorArr.forEach(function (item) {

			gradient.addColorStop(item.stop, item.color);

		});

		context.fillStyle = gradient;
		context.fillRect(0, 0, canvas.width, canvas.height);

		return canvas;

	}

	this.startParticles = function (startPos, endPos, height, speed) {
		initparticleSystems(15, [255, 255, 255]);//20个点出现
		var dx = endPos.x - startPos.x;
		var dy = endPos.y - startPos.y;
		var dz = endPos.z - startPos.z;
		var d = Math.sqrt(dx * dx + dy * dy + dz * dz);

		var curve = new THREE.CubicBezierCurve3(
			new THREE.Vector3(startPos.x, startPos.y, startPos.z),
			new THREE.Vector3(startPos.x + dx / 3, startPos.y + dy / 3, height),
			new THREE.Vector3(endPos.x - dx / 3, endPos.y - dy / 3, height),
			new THREE.Vector3(endPos.x, endPos.y, endPos.z)
		);

		var geometry = new THREE.Geometry();
		geometry.vertices = curve.getPoints(50);

		var material = new THREE.ShaderMaterial({

			vertexShader: `
			void main() {
				vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
				gl_Position = projectionMatrix * mvPosition;
			}
			`,
			fragmentShader: `
			void main() {
				gl_FragColor = vec4( 0.745, 0.402, 0.8, 0.8 );
			}
			`,

			blending: THREE.AdditiveBlending,
			transparent: true

		});
		var line = new MeshLine();
		line.setGeometry(geometry);
		var material = new MeshLineMaterial({
			color: 0x58b3cc,
			lineWidth: 160,
			opacity: 0.3,
			transparent: true,
			depthWrite: false
		});
		var mesh = new THREE.Mesh(line, material);
		scene.add(mesh);


		var geometry = new THREE.CircleGeometry(500, 100);
		var material = new THREE.MeshBasicMaterial({ color: 0x33aa00 });
		var circle = new THREE.Mesh(geometry, material);
		//// circle.rotation.x = -Math.PI / 2;
		//// circle.position.y = 0.1;
		//circle.position.set(endPos.x, endPos.y, endPos.z);

		//scene.add(circle);

		var time = d / speed;

		start(curve, time);

		function start(curve, time) {
			for (var i = 0; i < particleSystems.length; i++) {
				if (particleSystems[i].available) {

					var particleSystem = particleSystems[i];
					particleSystem.available = false;

					var firstParticle = particleSystem.particles[0];
					var lastParticle = particleSystem.particles[particleSystem.particles.length - 1];

					var startDelay = Math.random() * 2500;

					for (var k = 0; k < particleSystem.particles.length; k++) {
						var particle = particleSystem.particles[k];
						particle.scale.set((800 - k * 30), (800 - k * 30), (800 - k * 30));

						var tween = new TWEEN.Tween(particle)
							.delay(startDelay + k * 10)
							.to({ pos: 1 }, time)
							.onStart(function () {
								var point = curve.getPointAt(0);
								this.position.copy(point);
								this.visible = true;
							})
							.onUpdate(function () {
								var point = curve.getPointAt(this.pos);
								this.position.copy(point);
							})
							.onComplete(function () {
								this.pos = 0;
								this.visible = false;
								if (this === lastParticle) {
									particleSystem.available = true;
									start(curve, time);
								}
							})
						tween.start();
					}
					break;
				}
			}
		}

	}
	//coords坐标,length线的长度,speed速度
	this.createODLineByPoints = function (coords, color, length, speed) {
		initparticleSystems(length, color);
		var geometry = new THREE.Geometry();
		geometry.vertices = coords;
		var line = new MeshLine();
		line.setGeometry(geometry);
		var material = new MeshLineMaterial({
			color: 0x58b3cc,
			lineWidth: 160,
			opacity: 0.3,
			transparent: true,
			depthWrite: false
		});
		var mesh = new THREE.Mesh(line, material);
		scene.add(mesh);

		//var vector = new THREE.Vector3(coords[0].x, coords[0].y, coords[0].z).unproject(camera);
		// //在视点坐标系中形成射线,射线的起点向量是照相机， 射线的方向向量是照相机到点击的点，这个向量应该归一标准化。
		// var raycaster = new THREE.Raycaster(camera.position, vector.sub(camera.position).normalize());
		// var objects = null;
		// //射线和模型求交，选中一系列直线
		// var intersects = raycaster.intersectObjects(objects);
		var curve = new THREE.SplineCurve(
			coords.map(function (e) {
				return new THREE.Vector2(e.x, e.y);
			})
		);
		var smooth = curve.getSpacedPoints(5000);
		//创建粒子
		var time = 2000;

		start(coords, time);

		function start(coords, time) {
			for (var i = 0; i < particleSystems.length; i++) {
				if (particleSystems[i].available) {

					var particleSystem = particleSystems[i];
					particleSystem.available = false;

					var firstParticle = particleSystem.particles[0];
					var lastParticle = particleSystem.particles[particleSystem.particles.length - 1];

					var startDelay = Math.random() * 2500;

					for (var k = 0; k < particleSystem.particles.length; k++) {
						var particle = particleSystem.particles[k];
						if (particleSystem.particles.length >= 100) {
							particle.scale.set((500 - k * 5), (500 - k * 10), (500 - k * 10));
						} else {
							particle.scale.set((500 - k * 3), (500 - k * 3), (500 - k * 3));
						}
						var tween = new TWEEN.Tween(particle)
							.delay(startDelay + k * 5)
							.to({ pos: 5000 }, time)
							.onStart(function () {
								var point = new THREE.Vector3(smooth[0].x, smooth[0].y, 100);
								this.position.copy(point);
								this.visible = true;
							})
							.onUpdate(function () {
								var point = new THREE.Vector3(smooth[parseInt(this.pos)].x, smooth[parseInt(this.pos)].y, 100);
								this.position.copy(point);
							})
							.onComplete(function () {
								this.pos = 0;
								this.visible = false;
								if (this === lastParticle) {
									particleSystem.available = true;
									start(coords, time);
								}
							})
						tween.start();
					}
					break;
				}
			}
		}

	}


}