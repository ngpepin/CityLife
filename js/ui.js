import { clamp, lerp, pretty } from "./utils.js";

export class UI {
  constructor(){
    this.incomeVal = document.getElementById("incomeVal");
    this.happyVal  = document.getElementById("happyVal");
    this.wellVal   = document.getElementById("wellVal");

    this.incomeBar = document.getElementById("incomeBar");
    this.happyBar  = document.getElementById("happyBar");
    this.wellBar   = document.getElementById("wellBar");

    this.toast = document.getElementById("toast");

    this.spark = {
      income: document.getElementById("incomeSpark").getContext("2d"),
      happy:  document.getElementById("happySpark").getContext("2d"),
      well:   document.getElementById("wellSpark").getContext("2d"),
    };

    this.history = {
      income: [],
      happy: [],
      well: []
    };

    this.smooth = { income:0, happy:50, well:50 };
    this.toastTimer = null;
  }

  showToast(msg){
    this.toast.textContent = msg;
    this.toast.classList.remove("hidden");
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(()=> this.toast.classList.add("hidden"), 1400);
  }

  pushHistory(metrics){
    this.history.income.push(metrics.income);
    this.history.happy.push(metrics.happiness);
    this.history.well.push(metrics.wellness);
    const max = 48;
    for (const k of Object.keys(this.history)){
      while (this.history[k].length > max) this.history[k].shift();
    }
  }

  update(metrics){
    // Smooth values a bit
    this.smooth.income = lerp(this.smooth.income, metrics.income, 0.2);
    this.smooth.happy  = lerp(this.smooth.happy, metrics.happiness, 0.25);
    this.smooth.well   = lerp(this.smooth.well, metrics.wellness, 0.25);

    this.incomeVal.textContent = pretty(this.smooth.income);
    this.happyVal.textContent  = Math.round(this.smooth.happy);
    this.wellVal.textContent   = Math.round(this.smooth.well);

    // Bars: income normalized for display
    const incomeNorm = clamp(this.smooth.income / 220, 0, 1);
    this.incomeBar.style.width = `${incomeNorm*100}%`;
    this.happyBar.style.width  = `${clamp(this.smooth.happy/100,0,1)*100}%`;
    this.wellBar.style.width   = `${clamp(this.smooth.well/100,0,1)*100}%`;

    this.drawSpark(this.spark.income, this.history.income, 0, 260);
    this.drawSpark(this.spark.happy, this.history.happy, 0, 100);
    this.drawSpark(this.spark.well, this.history.well, 0, 100);
  }

  drawSpark(ctx, arr, lo, hi){
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    ctx.clearRect(0,0,w,h);

    // grid line
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.moveTo(0,h-1);
    ctx.lineTo(w,h-1);
    ctx.stroke();
    ctx.globalAlpha = 1;

    if (arr.length < 2) return;

    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(53,255,154,0.85)";
    ctx.beginPath();
    for (let i=0; i<arr.length; i++){
      const t = i/(arr.length-1);
      const x = t*(w-2)+1;
      const v = clamp((arr[i]-lo)/(hi-lo), 0, 1);
      const y = (h-3) - v*(h-6) + 2;
      if (i===0) ctx.moveTo(x,y);
      else ctx.lineTo(x,y);
    }
    ctx.stroke();

    // end dot
    const last = arr[arr.length-1];
    const v = clamp((last-lo)/(hi-lo), 0, 1);
    const x = w-2;
    const y = (h-3) - v*(h-6) + 2;
    ctx.fillStyle = "rgba(120,140,255,0.95)";
    ctx.beginPath();
    ctx.arc(x,y,3,0,Math.PI*2);
    ctx.fill();
  }
}
