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
  },
  tick: function() {
    if (this.el.object3D.position.y < this.data.ground_level) {
      var visible_line_trail = document.getElementById(
        "visible_line_trail" + this.el.id
      );
      //The rain drop a-sphere gets deleted when it goes below the ground level (using the remove-below-ground component)
      // But the trail doesn't get deleted in some cases, so we need to delete it here.
      if (visible_line_trail) {
        visible_line_trail.parentElement.removeChild(visible_line_trail);
      }
      this.el.parentElement.removeChild(this.el);
    }
  }
});

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

AFRAME.registerComponent("remove-below-ground", {
  schema: {
    ground_level: { type: "number", default: -3.0 }
  },
  tick: function() {
    if (this.el.object3D.position.y < this.data.ground_level) {
      var visible_line_trail = document.getElementById(
        "visible_line_trail" + this.el.id
      );
      //If trail component was added
      if (visible_line_trail) {
        visible_line_trail.parentElement.removeChild(visible_line_trail);
      }
      this.el.parentElement.removeChild(this.el);
    }
  }
});

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
    //If trail component was added
    if (visible_line_trail) {
      visible_line_trail.parentElement.removeChild(visible_line_trail);
    }
    if (particle) {
      particle.parentElement.removeChild(particle);
    }
  }
});
