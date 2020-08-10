# aframe-rain
A-Frame components to create a physically interactive particle system and shows particle trails

## Creating particle systems that have physics in A-Frame
Its been a little over a year since I've started developing AR/VR apps using Unity. At first, I joined a class at my college that taught the basics using a Hololens. After this, I bought my own Oculus Quest and have been using it thus far for my research and amusement. More recently, I've switched to developing Web XR apps with A-Frame after realizing that not all of my research study participants had a headset of their own in case I needed to conduct a large multi-user study. A-Frame seemed like an easy way for me to create cross-platform apps that would work on most devices that my participants used. However, I soon realized that some of what I'd taken for granted in  Unity required more thought and effort in A-Frame such as particle systems that would interact with digital objects in the scene. Specifically, I had to create rain that would interact with a 3D mesh, the ground, placed in an A-Frame scene. In addition to this, I wanted to display trails of variable length for the rain particles. It was easy enough to do this using particle systems in a Unity project but not so much using A-Frame. If you are like me and you've had this problem before, you might have tried out the [aframe-particle-system-component](https://www.npmjs.com/package/aframe-particle-system-component) or [aframe-rain](https://www.npmjs.com/package/aframe-rain) packages. What I realized after using these packages was that they create rain that doesn't interact with anything in the scene and may just have particles that trigger a splash animation after falling for a certain duration. Its possible that I might have missed out on something in the documentation for these packages or that I didn't search thoroughly enough for relevant packages. I just decided to write my own rain component using the [aframe-physics-system](https://github.com/donmccurdy/aframe-physics-system) and [cannon.js](https://schteppe.github.io/cannon.js/) packages. 

My requirements for the rain particle system were as follows:
 - The rain particles should be affected by gravity (and wind if needed). The mass and size of the particles should be variable.
 - A trail of the particles' past positions should be visible. The length of the trail should be variable.
 - The rain particles need to interact with certain objects (e.g. meshes, cubes, planes) I add to the A-Frame scene.
 - Some expected particle system attributes like how the particles are emitted,  how many are emitted, how frequently, duration of their lifetime etc.
 - The particles should resemble rain drops. Hyper-realism wasn't necessary.

Here's the final A-Frame scene that I created:
<div class="glitch-embed-wrap" style="width: 100%;">
  <iframe
    src="https://glitch.com/embed/#!/embed/ajar-successful-germanium?path=index.html&previewSize=100"
    title="A look at the final rain system on Glitch"
    allow="geolocation; microphone; camera; midi; vr; encrypted-media"
    style="height: 100%; width: 100%; border: 0;">
  </iframe>
</div>

## Creating particles that looked like rain drops

This was simple enough. Since I wasn't going for hyper-realistic droplets, I just decided to focus on the shape and material of the droplet. I use an \<a-sphere>  primitive for the shape and copied the color and other material attributes (metalness, roughness, opacity) from the ocean entity the A-Frame documentation example [here](https://aframe.io/docs/1.0.0/introduction/entity-component-system.html#using-unpkg). 

So it would be something like this:

    <a-sphere material="color: #9CE3F9; opacity: 0.75; metalness: 0; roughness: 1" radius="0.01"></a-entity>

## Adding physics to the rain drops (collisions, gravity and wind)
The [aframe-physics-system](https://github.com/donmccurdy/aframe-physics-system) and [cannon.js](https://schteppe.github.io/cannon.js/) packages make this easy. To enable the rain drops to have mass, fall down under the influence of gravity, and collide with other objects you would just need to add a `dynamic-body` component to it. Add a `static-body` component to objects that need to stay at a fixed position and remain unaffected by the collisions (e.g. ground plane).

    <a-sphere dynamic-body material="color: #9CE3F9; opacity: 0.75; metalness: 0; roughness: 1" radius="0.01"></a-entity>

To add a wind effect to the rain drops, I created the 'apply-wind' component. I use the `applyForce` function from cannon.js to apply a certain initial force vector to each rain drop. The force vectors also have some amount of random noise (within a standard deviation) added to them just for additional complexity.


    AFRAME.registerComponent("apply-wind", {
      schema: {
        x: { type: "number", default: 0.01 },
        y: { type: "number", default: 0.0 },
        z: { type: "number", default: 0.01 },
        std: { type: "number", default: 0.05 }
      },
      init: function() {
        this.el.body.applyForce(
          /* force vector with some small random deviation added */ new CANNON.Vec3(
            this.data.x * (1 - Math.random() * this.data.std),
            this.data.y * (1 - Math.random() * this.data.std),
            this.data.z * (1 - Math.random() * this.data.std)
          ),
          new CANNON.Vec3().copy(this.el.object3D.position)
        );
      }
    });

## Adding a trail for the particles
The basic idea here was to save the particle positions for the past **x** ticks and create **x-1** line segment joining these positions to show a trail. I created a component `'position-trail'`that does this by saving the past **x** positions in a buffer and popping and unshifting them to update the buffer with the most recent position. Finally, I draw a line between consecutive points in the buffer to create the trail.

    AFRAME.registerComponent("position-trail", {
      schema: {
        position_buffer: { type: "array", default: [] },
        trail_length: { type: "int", default: 2 },
        trail_width: { type: "number", default: 0.05 },
        trail_opacity: { type: "number", default: 0.85 },
        trail_color: { default: "#9CE3F9" }
      },
      init: function() {
        //Initialize the position buffer with trail_length number of elements having the value of the current position
        for (var i = 0; i < this.data.trail_length; i++) {
          this.data.position_buffer[i] = new THREE.Vector3().copy(
            this.el.object3D.position
          );
        }
        //Create an entity with an id that can match it with a specific particle
        //This will help to update or delete it when the particle a-sphere is updated or deleted
        var visible_line_trail = document.createElement("a-entity");
        visible_line_trail.setAttribute("id", "visible_line_trail" + this.el.id);
        document.getElementsByTagName("a-scene")[0].appendChild(visible_line_trail);
      },
      tick: function(time, timeDelta) {
        var visible_line_trail = document.getElementById(
          "visible_line_trail" + this.el.id
        );
        
        //Remove the oldest value in the position buffer and insert the current position
        for (var i = this.data.trail_length - 1; i > 0; i--) {
          this.data.position_buffer[i] = new THREE.Vector3().copy(
            this.data.position_buffer[i - 1]
          );
        }
        this.data.position_buffer[0] = new THREE.Vector3().copy(
          this.el.object3D.position
        );
    
        //Draw a line between consective points in the position buffer
        for (var i = 0; i < this.data.trail_length - 1; i++) {
          var line_string = "line__" + (i + 1);
          if (i == 0) {
            line_string = "line";
          }
          visible_line_trail.setAttribute(line_string, {
            start: AFRAME.utils.coordinates.stringify(
              this.data.position_buffer[i + 1]
            ),
            end: AFRAME.utils.coordinates.stringify(this.data.position_buffer[i]),
            opacity: this.data.trail_opacity,
            color: this.data.trail_color
          });
        }
      },
      remove: function() {},
      pause: function() {},
      play: function() {}
    }); 
    
## Deleting particles that fall below the ground
This was more of an optimization step. I created a component `"remove-below-ground"` to delete particles and their trails when their position fell below a certain height. This would clear up some memory for new particles.

    AFRAME.registerComponent('remove-below-ground', {
            schema:{
              ground_level:{type: 'number', default: -3.0} 
            },
            tick:function(){
              if(this.el.object3D.position.y<this.data.ground_level){
                var visible_line_trail = document.getElementById("visible_line_trail"+this.el.id);
              //If trail component was added
              if(visible_line_trail){
                visible_line_trail.parentElement.removeChild(visible_line_trail);
              }
                this.el.parentElement.removeChild(this.el);
              }
            }
          });
I could probably have implemented this as part of a system for the particles rather than as a component that I add to the particles.

## Emitting a number of particles periodically
I created a component `particles` to generate `particle_count`number of rain drops at the start of every `emission_interval`. Each particle is initialized at a random point inside a cylinder of radius and height equal to `emission_radius`. This can easily be changed to be a random location in a cube or some other emission surface. The particles are also deleted after a certain `deletion_interval` which isn't necessary the same as the `emission_interval`. So particles can persists even after a new batch of particles has been emitted.

    AFRAME.registerComponent("particles", {
      schema: {
        particle_count: { type: "int", default: 25 },
        particle_opacity: { type: "number", default: 0.45 },
        particle_metalness: { type: "number", default: 0.0 },
        particle_roughness: { type: "number", default: 1.0 },
        particle_radius: { type: "number", default: 0.01 },
        particle_color: { default: "#9CE3F9" },
        particle_mass: { type: "number", default: 0.001 },
        emission_interval: { type: "int", default: 500 },
        deletion_interval: { type: "int", default: 4000 },
        emission_radius: { type: "int", default: 4 }
      },
      init: function() {
        this.tick = AFRAME.utils.throttleTick(
          this.tick,
          this.data.emission_interval,
          this
        );
      },
      createParticle: function(rand_position) {
        var particle = document.createElement("a-sphere");
        particle.object3D.position.copy(rand_position);
        particle.setAttribute("radius", this.data.particle_radius);
        particle.setAttribute("position-trail", "");
        particle.setAttribute("material", {
          color: this.data.particle_color,
          opacity: this.data.particle_opacity,
          metalness: this.data.particle_metalness,
          roughness: this.data.particle_roughness
        });
        particle.setAttribute("dynamic-body", { mass: this.data.particle_mass });
        particle.setAttribute("apply-wind", "");
        particle.setAttribute("remove-below-ground", "");
        particle.setAttribute("id", "_particle" + Date.now());
        document.getElementsByTagName("a-scene")[0].appendChild(particle);
        setTimeout(this.deleteParticle, this.data.deletion_interval, particle.id);
      },
      tick: function(time, timeDelta) {
        // Initialize particle at a location in a cyclinder with radius=emission_radius and height emission_radius
        // Also add some random noise to the positions
        var rand_angle = Array.from(Array(this.data.particle_count)).map(
          x => Math.random() * Math.PI * 2
        );
        var rand_positions = rand_angle.map(
          x =>
            new THREE.Vector3(
              this.el.object3D.position.x +
                Math.cos(x) * Math.random() * this.data.emission_radius,
              this.el.object3D.position.y +
                (2 * Math.random() - 1) * this.data.emission_radius,
              this.el.object3D.position.z +
                Math.sin(x) * Math.random() * this.data.emission_radius
            )
        );
        rand_positions.forEach(x => this.createParticle(x));
      },
      deleteParticle: function(particle_id) {
        var visible_line_trail = document.getElementById(
          "visible_line_trail" + particle_id
        );
        var particle = document.getElementById(particle_id);
        //If trail component was added remove it
        if (visible_line_trail) {
          visible_line_trail.parentElement.removeChild(visible_line_trail);
        }
        if (particle) {
          particle.parentElement.removeChild(particle);
        }
      }
    });
Notice that I add the previously described components (`"apply-wind","remove-below-ground"`etc.) to the rain particles in this code.

## Initializing the rain particles in the HTML body
This just requires adding the `"particles"`component to an entity in the scene. The entity will act as the central location for the particle generation.

      <body>
        <a-scene background="color: black" physics="restitution:0.15;">
          <a-assets>
          </a-assets>
           <a-sphere position="0 10 -10"color="black" radius="0.04" particles>
           </a-sphere>
           <a-plane height="10" width="10" rotation="-90 0 0" position="0 -1 -10" color="#FF0000" static-body></a-plane>
           <a-entity id="rig" position="0 1.6 0">
             <a-camera id="camera"></a-camera>
           </a-entity>
        </a-scene>
      </body>

`restitution` is an attribute of the physics component from the [aframe-physics-system](https://github.com/donmccurdy/aframe-physics-system) package. It determines how much a dynamic body will bounce on collision. The closer it is to zero, the more the damping. I set it to 0.15 since it felt close to how much a rain drop would bounce on the ground. I couldn't spent some more time figuring out how to make this variable based on the material of the colliding objects (maybe I could get colliding raindrops to stick that way).

## The final A-Frame scene (once again) and limitations
<div class="glitch-embed-wrap" style="width: 100%;">
  <iframe
    src="https://glitch.com/embed/#!/embed/ajar-successful-germanium?path=index.html&previewSize=100"
    title="A look at the final rain system on Glitch"
    allow="geolocation; microphone; camera; midi; vr; encrypted-media"
    style="height: 100%; width: 100%; border: 0;">
  </iframe>
</div>

The attributes of the components can be tweaked to create other kinds of particle systems (e.g. snow, dust, ...). However, there are many limitations to the code as is. Adding the trail and real-time collisions seems to be a very resource intensive process for the browser. So, the number of particles I could simulate at a time and the length of the trail were constrained to allow for smooth, quick simulation. There are other issues with collision involving fast-moving bodies and extremely thin bodies. So, for example, if you have a mesh object you've generated using photogrammetry that you would like to simulate the flow of water on, most of the rain particles might just slip through the mesh instead of interacting with it. The same thing happens even for the simple plane in the linked [glitch example](https://ajar-successful-germanium.glitch.me). This is a known issue with the [aframe-physics-system](https://github.com/donmccurdy/aframe-physics-system) package that has been referenced in their [github issue](https://github.com/schteppe/cannon.js/issues/202). It shouldn't be too much of a problem with other solid objects like cubes, spheres, etc. Visually, my rain particles could use some splash animation, and a rain texture to make them look more appealing.

Once again, I'm not sure if there's a physics system for Web XR that has already implemented components for physical particle systems as I've described in my requirements. It was just fun building something myself with the available packages. I wasn't too concerned with optimizing the code, so if there is a well-tested efficient library for Web XR do let me know.
