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
    //if (!mousedown) return;
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
    fogFar: 1.25,
    fieldSize: 15,
    objectCount: 40,
    fireflyCount: 50,
    fireflyIntensity: 2,
    sunIntensity: 1,
    camera: 0,
    blinn: false,
    stoneShininess: 4,
    plantShininess: 10,
    groundShininess: 7,
    dayNightCycle: true,
    lightLinear: 1,
    lightQuadratic: 0.7,
    lightConstant: 2,
    flashlight: false,
    treeGrid: 7,
    plantGrid: 2
  };

  webglLessonsUI.setupUI(document.querySelector("#ui"), settings, [
    {
      type: "slider",
      key: "fogFar",
      min: 0,
      max: 3,
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
      key: "treeGrid",
      min: 1,
      max: 10,
      precision: 0,
      step: 1,
    },
    {
      type: "slider",
      key: "plantGrid",
      min: 1,
      max: 10,
      precision: 0,
      step: 1,
    },
    {
      type: "slider",
      key: "camera",
      min: 0,
      max: 3,
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
    }
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


    twgl.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    m4.perspective(fieldOfViewRadians, aspect, 1, 2000, projection);

    let playerPosition = [cameraTranslate[0], 2.5 + cameraTranslate[1], cameraTranslate[2]];
    let cameraPosition = playerPosition;
    let up = [0, 1, 0];
    let target = [Math.cos(mouseNormX * Math.PI * 2) + playerPosition[0], 4*(0.5 - mouseNormY) + playerPosition[1], Math.sin(mouseNormX * Math.PI * 2) + playerPosition[2]];
    if(settings.camera == 1) {
      cameraPosition = [cameraPosition[0]+5, cameraPosition[1]+7, cameraPosition[2]];
      target = playerPosition;
    }
    else if (settings.camera == 2) {
      target = sunPosition[1] <= 0 ? moonPosition : sunPosition;
    } else if (settings.camera == 3) {
      target = [playerPosition[0], playerPosition[1], playerPosition[2]];
      let objPosition = sunPosition;
      if(sunPosition[1] <= 0) objPosition = moonPosition;
      cameraPosition = [(objPosition[0]-playerPosition[0])*0.4+playerPosition[0], (objPosition[1]-playerPosition[1])*0.4+playerPosition[1],(objPosition[2]-playerPosition[2])*0.4+playerPosition[2]];
    }

    const movementSpeed = 0.15;
    if(settings.camera == 0) {
      let forward = [target[0]-cameraPosition[0], target[1]-cameraPosition[1], target[2]-cameraPosition[2]]; 
      if(keys['KeyW']) cameraTranslate = [cameraTranslate[0]+forward[0]*movementSpeed, cameraTranslate[1], cameraTranslate[2]+forward[2]*movementSpeed];
      if(keys['KeyS']) cameraTranslate = [cameraTranslate[0]-forward[0]*movementSpeed, cameraTranslate[1], cameraTranslate[2]-forward[2]*movementSpeed];
      if(keys['KeyZ']) cameraTranslate = [cameraTranslate[0], cameraTranslate[1]-movementSpeed, cameraTranslate[2]];
      if(keys['KeyX']) cameraTranslate = [cameraTranslate[0], cameraTranslate[1]+movementSpeed, cameraTranslate[2]];
    }
    else if(settings.camera == 1) {
      if(keys['KeyD']) cameraTranslate = [cameraTranslate[0], cameraTranslate[1], cameraTranslate[2]-movementSpeed];
      if(keys['KeyW']) cameraTranslate = [cameraTranslate[0]-movementSpeed, cameraTranslate[1], cameraTranslate[2]];
      if(keys['KeyS']) cameraTranslate = [cameraTranslate[0]+movementSpeed, cameraTranslate[1], cameraTranslate[2]];
      if(keys['KeyA']) cameraTranslate = [cameraTranslate[0], cameraTranslate[1], cameraTranslate[2]+movementSpeed];
      if(keys['KeyZ']) cameraTranslate = [cameraTranslate[0], cameraTranslate[1]-movementSpeed, cameraTranslate[2]];
      if(keys['KeyX']) cameraTranslate = [cameraTranslate[0], cameraTranslate[1]+movementSpeed, cameraTranslate[2]];
    }

    // Compute the camera's matrix using look at.
    const camera = m4.lookAt(cameraPosition, target, up);
    m4.inverse(camera, view);
    let treeGrid = settings.treeGrid;
    let plantGrid = settings.plantGrid;
    const treeAnchor = [Math.floor(playerPosition[0] / treeGrid) * treeGrid, Math.floor(playerPosition[1] / treeGrid) * treeGrid, Math.floor(playerPosition[2] / treeGrid) * treeGrid];
    const plantAnchor = [Math.floor(playerPosition[0] / plantGrid) * plantGrid, Math.floor(playerPosition[1] / plantGrid) * plantGrid, Math.floor(playerPosition[2] / plantGrid) * plantGrid];
    let treeOffset = Math.floor(settings.fieldSize / treeGrid) * treeGrid;
    //if(treeOffset % 2 != 0) treeOffset++;
    let plantOffset = Math.floor(settings.fieldSize / plantGrid) * plantGrid;
    //if(plantOffset % 2 != 0) plantOffset++;

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    if(settings.dayNightCycle) {
      let dayTime = time*0.2;// + Math.PI;
      bgColor = interp(fogColor, [0.02, 0.05, 0.08, 1], Math.sin(dayTime) / 2 + 0.5);
      let rad = 50;
      sunPosition = [playerPosition[0], Math.sin(dayTime) * rad, Math.cos(dayTime) * rad + playerPosition[2]];
      moonPosition = [playerPosition[0], Math.sin(dayTime + Math.PI) * rad, Math.cos(dayTime + Math.PI) * rad + playerPosition[2]];
      sunColor = interp(sunColor, moonColor, Math.sin(dayTime) / 2 + 0.5);
      sunIntensity = interp([1.0], [0.01], Math.sin(dayTime) / 2 + 0.5);
      fogDistance = interp([settings.fogFar], [settings.fogFar * 1.3], Math.sin(dayTime) / 2 + 0.5);
      ambient = interp([0.0], [0.0], Math.sin(dayTime) / 2 + 0.5)[0];
    }
    gl.clearColor(...bgColor);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

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
      if(dis([fireflies[i].x, fireflies[i].y, fireflies[i].z], playerPosition) > settings.fieldSize * settings.fieldSize) {
        fireflies[i].x = rand(-settings.fieldSize, settings.fieldSize) + playerPosition[0];
        fireflies[i].y = rand(0.5, 1.5);
        fireflies[i].z = rand(-settings.fieldSize, settings.fieldSize) + playerPosition[2];
      }
      fireflies[i].x += Math.cos(a) * fireflies[i].speed;
      fireflies[i].z += Math.sin(a) * fireflies[i].speed;
      fireflies[i].y += Math.cos(a2) * fireflies[i].speed / 10;
    }

    let lights = fireflies.sort((a, b) => dis([a.x, a.y, a.z], playerPosition) - dis([b.x, b.y, b.z], playerPosition)).map(f => {return {position: [f.x, f.y, f.z], color: fireflyColor, specularColor: fireflyColor, type: 1, intensity: 2}});
    lights = [sunLight, ...lights.slice(0, 19)];

    let flashPosition = [playerPosition[0], playerPosition[1], playerPosition[2]];

    gl.useProgram(programInfo.program);
    twgl.setUniforms(programInfo, {
      u_lightWorldPosition: sunPosition,
      u_projection: projection,
      u_view: view,
      u_fogColor: bgColor,
      u_fogNear: settings.fogNear,
      u_fogFar: settings.fieldSize * settings.fogFar,
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
      u_flashDirection: [target[0] - flashPosition[0], target[1] - flashPosition[1], target[2] - flashPosition[2]],
      u_ambient: 0
    });

    // plants
    let shape = shapes[1];
    twgl.setBuffersAndAttributes(gl, programInfo, shape);

    for(let i = plantAnchor[0] - plantOffset; i <= plantAnchor[0] + plantOffset; i+=plantGrid)
      for(let j = plantAnchor[2] - plantOffset; j <= plantAnchor[2] + plantOffset; j+=plantGrid) {
        let scale = 0.3;
        let a = noise.perlin3(i * scale, j * scale, time * 0.7) * Math.PI ;
        let a2 = noise.perlin2(i * scale, j * scale) * Math.PI * (Math.abs(noise.perlin2(i * scale + 100, j * scale + 100)) + 1);
        //let off1 = 0, off2 = 0;
        let off1 = Math.cos(a) * 0.1, off2 = Math.sin(a) * 0.1;
        let off3 = Math.cos(a2), off4 = Math.sin(a2);
        let pos = [i - off2 + off3, 0.5, j + off1 + off4]
        let world = m4.translate(m4.identity(), pos);
        let w = noise.perlin2(i * scale, j * scale) + 2;
        world = m4.translate(world, [0, w/3, 0]);
        world = m4.scale(world, [w, w, w]);
        world = m4.rotateX(world, Math.PI / 2 + off1);
        world = m4.rotateY(world, off2);
        //let ang = Math.atan2( target[2] - playerPosition[2], target[0] - playerPosition[0] );
        //world = m4.rotateZ(world, ang + Math.PI / 2);
        //world = m4.rotateZ(world, plants[i].rotate);
        let worldInverseTranspose = m4.transpose(m4.inverse(world));

        let xoff = 1.0 / (plantTypes+1);
        let xcoord = Math.floor((noise.perlin2(i * 0.6, j * 0.6) * 0.5 + 0.5) * (plantTypes + 0.5))*xoff;
       
        let horizontal = noise.perlin2(i * scale, j * scale) * 0.5 + 0.5;
        let horizontalChance = 0.4;
        if(horizontal < horizontalChance) {
          xcoord = plantTypes*xoff;
          world = m4.rotateX(world, Math.PI / 2);
          world = m4.translate(world, [0, 0.5, 0]);
        }

        twgl.setAttribInfoBufferFromArray(gl, shape.attribs.a_texcoord, new Float32Array([xcoord, 0, xcoord+xoff, 0, xcoord, 1, xcoord+xoff, 1]));
        twgl.setUniforms(programInfo, {
          u_worldInverseTranspose: worldInverseTranspose,
          u_world: world,
          u_texture: twoDTextures[0],
        });

        twgl.drawBufferInfo(gl, shape);

        if(horizontal < horizontalChance) continue;

        world = m4.rotateZ(world, Math.PI / 2);
        worldInverseTranspose = m4.transpose(m4.inverse(world));

        twgl.setUniforms(programInfo, {
          u_worldInverseTranspose: worldInverseTranspose,
          u_world: world
        });
        
        twgl.drawBufferInfo(gl, shape);
      }


    /*for (let i = 0; i < plantCount; i++) {
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
      let ang = Math.atan2( target[2] - playerPosition[2], target[0] - playerPosition[0] );
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
    }*/

    

    // trees

    twgl.setUniforms(programInfo, {
      u_shininess: settings.stoneShininess,
      u_texture: textures.bark,
    });
    
    /*for (let i = 0; i < treeCount; i++) {
      
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
    }*/


    for(let i = treeAnchor[0] - treeOffset; i <= treeAnchor[0] + treeOffset; i+=treeGrid)
      for(let j = treeAnchor[2] - treeOffset; j <= treeAnchor[2] + treeOffset; j+=treeGrid) {
        let scale = 0.6;
        let a2 = noise.perlin2(i * scale, j * scale) * Math.PI * (Math.abs(noise.perlin2(i * scale + 100, j * scale + 100)) + 1);
        let off3 = Math.cos(a2) * 5, off4 = Math.sin(a2) * 5;
        let pos = [i + off3, 25, j + off4];
        let w = noise.perlin2(i * scale + 200, j * scale + 200) * 0.5 + 1.5;
        let world = m4.scale(m4.translate(m4.identity(), pos), [w, 1, w]);
        let worldInverseTranspose = m4.transpose(m4.inverse(world));

        twgl.setUniforms(programInfo, {
          u_worldInverseTranspose: worldInverseTranspose,
          u_world: world,
        });
  
        shape = shapes[Math.floor((noise.perlin2(i * scale, j * scale) * 0.5 + 0.5) * (1.9))+2];
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
    let groundAnchor = [Math.floor(playerPosition[0] / groundScale) * groundScale, 0, Math.floor(playerPosition[2] / groundScale) * groundScale]
    for(let i = -settings.fieldSize + groundAnchor[0] - groundScale; i <= settings.fieldSize+ groundAnchor[0] + groundScale; i+=groundScale)
      for(let j = -settings.fieldSize+ groundAnchor[2] - groundScale; j <= settings.fieldSize+ groundAnchor[2] + groundScale; j+=groundScale) {
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
    let world = m4.scale(m4.translate(m4.identity(), sunPosition), [2, 2, 2]);
    let worldInverseTranspose = m4.transpose(m4.inverse(world));

    twgl.setUniforms(programInfo, {
      u_worldInverseTranspose: worldInverseTranspose,
      u_world: world,
      u_nocolor: 2,
      u_subdivide: 0
    });

    twgl.setBuffersAndAttributes(gl, programInfo, shape);
    twgl.drawBufferInfo(gl, shape);

    world = m4.scale(m4.translate(m4.identity(), moonPosition), [2, 2, 2]);
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