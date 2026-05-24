// KPSS Platformu: Uçuşan Işık Partikülleri ve Parlayan Yıldızlar (Canvas)

class SpaceBackground {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.stars = [];
    this.maxParticles = 40;
    this.maxStars = 25;
    
    this.init();
    this.animate();
    
    window.addEventListener('resize', () => this.resize());
  }
  
  init() {
    this.resize();
    
    // Create floating light particles
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        radius: Math.random() * 2.5 + 0.5,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        alpha: Math.random() * 0.5 + 0.1,
        color: i % 2 === 0 ? 'rgba(59, 130, 246,' : 'rgba(16, 185, 129,' // Alternate sapphire & emerald
      });
    }
    
    // Create twinkling background stars
    for (let i = 0; i < this.maxStars; i++) {
      this.stars.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        size: Math.random() * 1.5 + 0.2,
        alpha: Math.random(),
        speed: Math.random() * 0.015 + 0.003,
        growing: Math.random() > 0.5
      });
    }
  }
  
  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }
  
  animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw and update stars (twinkling)
    for (let star of this.stars) {
      if (star.growing) {
        star.alpha += star.speed;
        if (star.alpha >= 0.8) star.growing = false;
      } else {
        star.alpha -= star.speed;
        if (star.alpha <= 0.1) star.growing = true;
      }
      
      this.ctx.beginPath();
      this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(226, 232, 240, ${star.alpha})`;
      this.ctx.fill();
    }
    
    // Draw and update floating particles
    for (let p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      
      // Screen edge wrapping
      if (p.x < 0) p.x = this.canvas.width;
      if (p.x > this.canvas.width) p.x = 0;
      if (p.y < 0) p.y = this.canvas.height;
      if (p.y > this.canvas.height) p.y = 0;
      
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = `${p.color}${p.alpha})`;
      this.ctx.fill();
    }
    
    requestAnimationFrame(() => this.animate());
  }
}

// Initialise when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  new SpaceBackground('bg-canvas');
});
