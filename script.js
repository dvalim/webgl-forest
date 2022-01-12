import * as twgl from './twgl-full.module.js'

"use strict";

function main() {
  twgl.setDefaults({
    attribPrefix: "a_"
  });
  let mousedown = false;
  canvas.addEventListener("mousedown", e => {
    mousedown = true;
  })
  canvas.addEventListener("mouseup", e => {
    mousedown = false;
  })
  canvas.addEventListener("mousemove", e => {
    if (!mousedown) return;
    mouseNormX = e.offsetX / canvas.width;
    mouseNormY = e.offsetY / canvas.height;
  })

  const keys = {};
  function keyEventHandler(event){
    keys[event.code] = event.type === "keydown";
  }
  document.addEventListener("keydown",keyEventHandler);
  document.addEventListener("keyup",keyEventHandler);

  const m4 = twgl.m4;
  const gl = document.querySelector("#canvas").getContext("webgl");
  const programInfo = twgl.createProgramInfo(gl, ["vs", "fs"]);

  const shapes = [
    twgl.primitives.createSphereBufferInfo(gl, 1, 6, 6),
    twgl.primitives.createPlaneBufferInfo(gl, 1, 1),
    twgl.primitives.createCylinderBufferInfo(gl, 0.5, 50, 5, 2),
    twgl.primitives.createCylinderBufferInfo(gl, 0.5, 50, 12, 2),
  ];

  function rand(min, max) {
    if (max === undefined) {
      max = min;
      min = 0;
    }
    return min + Math.random() * (max - min);
  }

  // Shared values
  const projection = m4.identity();
  const view = m4.identity();
  const fieldOfViewRadians = 60 * Math.PI / 180.0;
  const fogColor = [0.78, 0.75, 0.87, 1];
  let sunColor = [1.0, 1.0, 0.984];
  let moonColor = [0.5, 0.5, 0.6];
  let fireflyColor = [0.9, 1, 0.2];
  let sunIntensity = [1.0];
  let sunPosition = [0, 0, 0],
    moonPosition = [0, 0, 0];
  let cameraTranslate = [0, 0, 0];
  let mouseNormX = 0.5,
    mouseNormY = 0.3;
  let ambient = 0;
  let bgColor = fogColor;
  let fogDistance = 0;
  let plants = [];
  let trees = [];
  let fireflies = [];
  let plantTypes = 6;

  const textures = twgl.createTextures(gl, {
    plants: {
      src: "./plants.png",
      minMag: gl.NEAREST
    },
    ground: {
      src: "./grass.png",
      minMag: gl.NEAREST
    },
    bark: {
      src: "./bark.png",
      minMag: gl.NEAREST
    }
  });

  const twoDTextures = [
    textures.plants,
    textures.grass,
    textures.ground,
    textures.stone
  ]

  let settings = {
    fogNear: 0,
    fogFar: 25.0,
    fieldSize: 25,
    objectCount: 40,
    fireflyCount: 50,
    fireflyIntensity: 2,
    sunIntensity: 1,
    camera: 0,
    blinn: false,
    stoneShininess: 30,
    plantShininess: 10,
    groundShininess: 70,
    dayNightCycle: true,
    lightLinear: 1,
    lightQuadratic: 0.7,
    lightConstant: 2,
    flashlight: false
  };

  webglLessonsUI.setupUI(document.querySelector("#ui"), settings, [
    {
      type: "slider",
      key: "lightConstant",
      min: 0,
      max: 2,
      precision: 5,
      step: 0.0001,
    },
    {
      type: "slider",
      key: "lightLinear",
      min: 0,
      max: 4,
      precision: 5,
      step: 0.0001,
    },
    {
      type: "slider",
      key: "lightQuadratic",
      min: 0,
      max: 4,
      precision: 5,
      step: 0.0001,
    },
    {
      type: "slider",
      key: "fogFar",
      min: 0,
      max: 80,
      precision: 3,
      step: 0.001,
    },
    {
      type: "slider",
      key: "fieldSize",
      min: 5,
      max: 50,
      precision: 0,
      step: 1,
    },
    {
      type: "slider",
      key: "fireflyCount",
      min: 0,
      max: 50,
      precision: 0,
      step: 1,
    },
    {
      type: "slider",
      key: "fireflyIntensity",
      min: 0,
      max: 20,
      precision: 3,
      step: 0.01,
    },
    {
      type: "slider",
      key: "sunIntensity",
      min: 0,
      max: 2,
      precision: 3,
      step: 0.01,
    },
    {
      type: "slider",
      key: "objectCount",
      min: 1,
      max: 100,
      precision: 0,
      step: 1,
    },
    {
      type: "slider",
      key: "camera",
      min: 0,
      max: 2,
      precision: 0,
      step: 1,
    },
    {
      type: "checkbox",
      key: "blinn",
      value: false
    },
    {
      type: "checkbox",
      key: "dayNightCycle",
      value: true
    },
    {
      type: "checkbox",
      key: "flashlight",
      value: false
    },
    {
      type: "slider",
      key: "plantShininess",
      min: 0.1,
      max: 100,
      precision: 3,
      step: 0.1,
    },
    {
      type: "slider",
      key: "stoneShininess",
      min: 0.1,
      max: 100,
      precision: 3,
      step: 0.1,
    },
    {
      type: "slider",
      key: "groundShininess",
      min: 0.1,
      max: 100,
      precision: 3,
      step: 0.1,
    },
  ]);

  let plantCount = settings.objectCount * settings.objectCount / 4;
  let treeCount = settings.objectCount * 1.5;

  for(let i = 0; i < plantCount; i++) {
    plants = [...plants, {
      x: rand(-settings.fieldSize, settings.fieldSize),
      y: 0,
      z: rand(-settings.fieldSize, settings.fieldSize),
      type: Math.floor(rand(0, plantTypes)),
      rotate: rand(0, 2*Math.PI),
      w: rand(2, 3)
    }]
  }

  for(let i = 0; i < treeCount; i++) {
    trees = [...trees, {
      x: rand(-settings.fieldSize, settings.fieldSize),
      y: 25,
      z: rand(-settings.fieldSize, settings.fieldSize),
      w: rand(0.5, 2),
      shape: Math.floor(rand(2, 3.9))
    }]
  }

  for(let i = 0; i < settings.fireflyCount; i++) {
    fireflies = [...fireflies, {
      x: rand(-settings.fieldSize, settings.fieldSize),
      z: rand(-settings.fieldSize, settings.fieldSize),
      y: rand(0.5, 1.5),
      speed: rand(0.005, 0.075)
    }]
  }

  function interp(arr1, arr2, step) {
    return arr1.map((el, id) => el * step + arr2[id] * (1 - step));
  }

  let then = 0;
  const fpsElem = document.querySelector("#fps");

  function dis(v1, v2) {
    return v1.map((el, id) => (el - v2[id])*(el - v2[id])).reduce((a, b) => a + b);
  }

  function render(time) {
    time *= 0.001; // convert to seconds
    time += 7;
    const deltaTime = time - then; // compute time since last frame
    then = time; // remember time for next frame
    const fps = 1 / deltaTime; // compute frames per second
    fpsElem.textContent = fps.toFixed(1); // update fps display

    const movementSpeed = 0.1;
    if(keys['KeyW']) cameraTranslate = [cameraTranslate[0], cameraTranslate[1], cameraTranslate[2]-movementSpeed];
    if(keys['KeyS']) cameraTranslate = [cameraTranslate[0], cameraTranslate[1], cameraTranslate[2]+movementSpeed];
    if(keys['KeyA']) cameraTranslate = [cameraTranslate[0]-movementSpeed, cameraTranslate[1], cameraTranslate[2]];
    if(keys['KeyD']) cameraTranslate = [cameraTranslate[0]+movementSpeed, cameraTranslate[1], cameraTranslate[2]];
    if(keys['KeyZ']) cameraTranslate = [cameraTranslate[0], cameraTranslate[1]-movementSpeed, cameraTranslate[2]];
    if(keys['KeyX']) cameraTranslate = [cameraTranslate[0], cameraTranslate[1]+movementSpeed, cameraTranslate[2]];


    twgl.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    if(settings.dayNightCycle) {
      let dayTime = time*0.2;
      bgColor = interp(fogColor, [0.02, 0.05, 0.08, 1], Math.sin(dayTime) / 2 + 0.5);
      sunPosition = [Math.cos(dayTime) * settings.fieldSize, Math.sin(dayTime) * settings.fieldSize, 0];
      moonPosition = [Math.cos(dayTime + Math.PI) * settings.fieldSize, Math.sin(dayTime + Math.PI) * settings.fieldSize, 0];
      sunColor = interp(sunColor, moonColor, Math.sin(dayTime) / 2 + 0.5);
      sunIntensity = interp([1.0], [0.01], Math.sin(dayTime) / 2 + 0.5);
      fogDistance = interp([settings.fogFar], [settings.fogFar * 1.3], Math.sin(dayTime) / 2 + 0.5);
      ambient = interp([0.0], [0.0], Math.sin(dayTime) / 2 + 0.5)[0];
    }
    gl.clearColor(...bgColor);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    m4.perspective(fieldOfViewRadians, aspect, 1, 2000, projection);

    let cameraPosition = [0 + cameraTranslate[0], 2.5 + cameraTranslate[1], 0 + cameraTranslate[2]];
    let up = [0, 1, 0];
    let target = [Math.cos(mouseNormX * Math.PI * 2) + cameraPosition[0], 4 - 4 * mouseNormY, Math.sin(mouseNormX * Math.PI * 2) + cameraPosition[2]];
    if (settings.camera == 1) {
      cameraPosition = [0, 1.5, 0];
      target = sunPosition[1] <= 0 ? moonPosition : sunPosition;
    } else if (settings.camera == 2) {
      if (sunPosition[1] <= 0)
        cameraPosition = [moonPosition[0], moonPosition[1] + 5, moonPosition[2]];
      else cameraPosition = [sunPosition[0], sunPosition[1] + 5, sunPosition[2]];
      target = [0, 2, 0];
    }

    // Compute the camera's matrix using look at.
    const camera = m4.lookAt(cameraPosition, target, up);
    m4.inverse(camera, view);

    let sunLight = {
      position: sunPosition,
      color: sunColor,
      specularColor: sunColor,
      type: 0,
      intensity: sunIntensity[0]
    }

    
    for(let i = 0; i < settings.fireflyCount; i++) {
      let scale = 0.5;
      let a = noise.perlin3(fireflies[i].x * scale, fireflies[i].y * scale, time * 0.1) * Math.PI;
      let a2 = noise.perlin3(fireflies[i].x * scale, fireflies[i].y * scale, time * 0.1+100) * Math.PI;
      if(Math.abs(fireflies[i].x) > settings.fieldSize || Math.abs(fireflies[i].z) > settings.fieldSize) {
        fireflies[i].x = rand(-settings.fieldSize, settings.fieldSize);
        fireflies[i].y = rand(0.5, 1.5);
        fireflies[i].z = rand(-settings.fieldSize, settings.fieldSize);
      }
      fireflies[i].x += Math.cos(a) * fireflies[i].speed;
      fireflies[i].z += Math.sin(a) * fireflies[i].speed;
      fireflies[i].y += Math.cos(a2) * fireflies[i].speed / 10;
    }

    let lights = fireflies.sort((a, b) => dis([a.x, a.y, a.z], cameraPosition) - dis([b.x, b.y, b.z], cameraPosition)).map(f => {return {position: [f.x, f.y, f.z], color: fireflyColor, specularColor: fireflyColor, type: 1, intensity: 2}});
    lights = [sunLight, ...lights.slice(0, 19)];

    let flashPosition = [cameraPosition[0], cameraPosition[1]-0.5, cameraPosition[2]];

    gl.useProgram(programInfo.program);
    twgl.setUniforms(programInfo, {
      u_lightWorldPosition: sunPosition,
      u_projection: projection,
      u_view: view,
      u_fogColor: bgColor,
      u_fogNear: settings.fogNear,
      u_fogFar: fogDistance,
      u_viewWorldPosition: cameraPosition,
      u_nocolor: 0,
      u_blinn: settings.blinn,
      u_ambientColor: [0, 0, 0],
      lightpos: sunPosition,
      u_shininess: settings.plantShininess,
      u_lightConstant: settings.lightConstant,
      u_lightLinear: settings.lightLinear,
      u_lightQuadratic: settings.lightQuadratic,
      u_lights: lights,
      u_lightCount: lights.length,
      u_flash: settings.flashlight,
      u_flashPosition: flashPosition,
      u_flashDirection: [target[0] - flashPosition[0], target[1] -0.5 - flashPosition[1], target[2] - flashPosition[2]],
      u_ambient: 0
    });

    // plants
    let shape = shapes[1];
    twgl.setBuffersAndAttributes(gl, programInfo, shape);
    for (let i = 0; i < plantCount; i++) {
      let scale = 0.1;
      let a = noise.perlin3(plants[i].x * scale, plants[i].z * scale, time * 0.7) * Math.PI * 0.1;
      //let off1 = 0, off2 = 0;
      let off1 = Math.cos(a), off2 = Math.sin(a);
      let pos = [plants[i].x - off2, plants[i].y, plants[i].z + off1]
      let world = m4.translate(m4.identity(), pos);
      world = m4.translate(world, [0, plants[i].w/2, 0]);
      world = m4.scale(world, [plants[i].w, plants[i].w, plants[i].w]);
      world = m4.rotateX(world, Math.PI / 5.5 + off1);
      world = m4.rotateY(world, off2);
      let ang = Math.atan2( target[2] - cameraPosition[2], target[0] - cameraPosition[0] );
      //world = m4.rotateZ(world, ang + Math.PI / 2);
      //world = m4.rotateZ(world, plants[i].rotate);
      let worldInverseTranspose = m4.transpose(m4.inverse(world));

      twgl.setUniforms(programInfo, {
        u_worldInverseTranspose: worldInverseTranspose,
        u_world: world,
        u_texture: twoDTextures[0],
      });
      let xoff = 1.0 / plantTypes;
      let xcoord = plants[i].type*xoff;
      twgl.setAttribInfoBufferFromArray(gl, shape.attribs.a_texcoord, new Float32Array([xcoord, 0, xcoord+xoff, 0, xcoord, 1, xcoord+xoff, 1]));

      twgl.drawBufferInfo(gl, shape);
      world = m4.rotateZ(world, Math.PI / 2);
      worldInverseTranspose = m4.transpose(m4.inverse(world));

      twgl.setUniforms(programInfo, {
        u_worldInverseTranspose: worldInverseTranspose,
        u_world: world
      });
      
      twgl.drawBufferInfo(gl, shape);
    }

    

    // trees

    twgl.setUniforms(programInfo, {
      u_shininess: 1,
      u_texture: textures.bark,
    });
    
    for (let i = 0; i < treeCount; i++) {
      
      let pos = [trees[i].x, trees[i].y, trees[i].z];
      let world = m4.scale(m4.translate(m4.identity(), pos), [trees[i].w, 1, trees[i].w]);
      let worldInverseTranspose = m4.transpose(m4.inverse(world));

      twgl.setUniforms(programInfo, {
        u_worldInverseTranspose: worldInverseTranspose,
        u_world: world,
      });

      shape = shapes[trees[i].shape];
      twgl.setBuffersAndAttributes(gl, programInfo, shape);
      twgl.drawBufferInfo(gl, shape);
    }

    // ground

    shape = shapes[1];
    

    twgl.setUniforms(programInfo, {
      u_texture: textures.ground,
      u_shininess: settings.groundShininess,
      u_subdivide: 0.25
    });

    twgl.setAttribInfoBufferFromArray(gl, shape.attribs.a_texcoord, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]));
    twgl.setBuffersAndAttributes(gl, programInfo, shape);

    let groundScale = 5;
    for(let i = -settings.fieldSize; i <= settings.fieldSize; i+=groundScale)
      for(let j = -settings.fieldSize; j <= settings.fieldSize; j+=groundScale) {
        let world = m4.translate(m4.identity(), [i, 0, j]);
        world = m4.scale(world, [groundScale, groundScale, groundScale]);
        let worldInverseTranspose = m4.transpose(m4.inverse(world));

        twgl.setUniforms(programInfo, {
          u_worldInverseTranspose: worldInverseTranspose,
          u_world: world,
        });
        twgl.drawBufferInfo(gl, shape);
      }

    // sun and moon

    shape = shapes[0];
    let world = m4.translate(m4.scale(m4.identity(), [2, 2, 2]), sunPosition);
    let worldInverseTranspose = m4.transpose(m4.inverse(world));

    twgl.setUniforms(programInfo, {
      u_worldInverseTranspose: worldInverseTranspose,
      u_world: world,
      u_nocolor: 2,
      u_subdivide: 0
    });

    twgl.setBuffersAndAttributes(gl, programInfo, shape);
    twgl.drawBufferInfo(gl, shape);

    world = m4.translate(m4.scale(m4.identity(), [2, 2, 2]), moonPosition);
    worldInverseTranspose = m4.transpose(m4.inverse(world));

    twgl.setUniforms(programInfo, {
      u_worldInverseTranspose: worldInverseTranspose,
      u_world: world,
    });

    twgl.drawBufferInfo(gl, shape);

    // fireflies

    twgl.setUniforms(programInfo, {
      u_nocolor: 1
    });

    for (let i = 0; i < settings.fireflyCount; i++) {
      let world = m4.scale(m4.translate(m4.identity(), [fireflies[i].x, fireflies[i].y, fireflies[i].z]), [0.05, 0.05, 0.05]);
      let worldInverseTranspose = m4.transpose(m4.inverse(world));

      twgl.setUniforms(programInfo, {
        u_worldInverseTranspose: worldInverseTranspose,
        u_world: world,
      });

      twgl.drawBufferInfo(gl, shape);
    }

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

main();