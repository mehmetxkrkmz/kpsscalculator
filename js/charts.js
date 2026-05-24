// KPSS Platformu: Çizim ve Performans Grafik Motoru (Chart.js)

let generalChartInstance = null;
let branchChartInstance = null;

// Get gradient helper
function createGradient(ctx, colorStart, colorEnd) {
  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, colorStart);
  gradient.addColorStop(1, colorEnd);
  return gradient;
}

export const ChartManager = {
  // GENERAL PROGRESS CHART (Score and Net Gelişimi)
  renderGeneralChart(canvasId, trials) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (generalChartInstance) {
      generalChartInstance.destroy();
    }

    if (!trials || trials.length === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = '14px Outfit';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText('Henüz kaydedilmiş genel deneme verisi bulunmuyor.', canvas.width / 2, canvas.height / 2);
      return;
    }

    // Sort trials oldest to newest for graphing
    const sorted = [...trials].reverse();
    
    const labels = sorted.map((t, idx) => {
      const date = new Date(t.date);
      return `${date.getDate()}/${date.getMonth() + 1} #${sorted.length - idx}`;
    });
    
    const scores = sorted.map(t => t.score);
    const nets = sorted.map(t => t.total_net);

    const scoreGradient = createGradient(ctx, 'rgba(59, 130, 246, 0.4)', 'rgba(59, 130, 246, 0.0)');
    const netGradient = createGradient(ctx, 'rgba(16, 185, 129, 0.4)', 'rgba(16, 185, 129, 0.0)');

    generalChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            type: 'line',
            label: 'KPSS Puanı',
            data: scores,
            borderColor: '#3b82f6',
            backgroundColor: scoreGradient,
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#3b82f6',
            pointHoverRadius: 8,
            yAxisID: 'yScore',
          },
          {
            type: 'bar',
            label: 'Toplam Net',
            data: nets,
            backgroundColor: '#10b981',
            borderRadius: 4,
            yAxisID: 'yNet',
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: '#94a3b8',
              font: { family: 'Outfit', size: 12 }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(11, 15, 25, 0.95)',
            titleFont: { family: 'Outfit', size: 13, weight: 'bold' },
            bodyFont: { family: 'Outfit', size: 12 },
            borderColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            displayColors: true
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.03)' },
            ticks: { color: '#94a3b8', font: { family: 'Outfit' } }
          },
          yScore: {
            type: 'linear',
            position: 'left',
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#3b82f6', font: { family: 'Outfit' } },
            title: { display: true, text: 'Tahmini Puan (50-100)', color: '#3b82f6', font: { family: 'Outfit' } },
            min: 50,
            max: 100
          },
          yNet: {
            type: 'linear',
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: { color: '#10b981', font: { family: 'Outfit' } },
            title: { display: true, text: 'Toplam Net (0-120)', color: '#10b981', font: { family: 'Outfit' } },
            min: 0,
            max: 120
          }
        }
      }
    });
  },

  // BRANCH NETS PROGRESS CHART
  renderBranchChart(canvasId, bTrials, branchName) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (branchChartInstance) {
      branchChartInstance.destroy();
    }

    // Filter by branch name
    const branchData = bTrials.filter(t => t.branchName.toLowerCase() === branchName.toLowerCase());

    if (!branchData || branchData.length === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = '14px Outfit';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText(`${branchName} branşı için henüz veri kaydedilmemiş.`, canvas.width / 2, canvas.height / 2);
      return;
    }

    // Sort oldest to newest
    const sorted = [...branchData].reverse();
    
    const labels = sorted.map((t, idx) => {
      const date = new Date(t.date);
      return `${date.getDate()}/${date.getMonth() + 1} #${sorted.length - idx}`;
    });
    
    const nets = sorted.map(t => t.net);

    const violetGradient = createGradient(ctx, 'rgba(139, 92, 246, 0.4)', 'rgba(139, 92, 246, 0.0)');

    // Max net value for sizing the Y axis (default 30 for most branches, custom branches can vary)
    let maxLimit = 30;
    if (branchName.toLowerCase() === 'türkçe' || branchName.toLowerCase() === 'matematik' || branchName.toLowerCase() === 'tarih') {
      maxLimit = 30;
    } else if (branchName.toLowerCase() === 'coğrafya') {
      maxLimit = 18;
    } else if (branchName.toLowerCase() === 'vatandaşlık') {
      maxLimit = 9;
    } else {
      // Find max net and round up to next 10 for custom branches
      const maxVal = Math.max(...nets);
      maxLimit = Math.max(10, Math.ceil((maxVal + 2) / 10) * 10);
    }

    branchChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: `${branchName} Net`,
            data: nets,
            borderColor: '#8b5cf6',
            backgroundColor: violetGradient,
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#8b5cf6',
            pointHoverRadius: 8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: '#94a3b8',
              font: { family: 'Outfit', size: 12 }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(11, 15, 25, 0.95)',
            titleFont: { family: 'Outfit', size: 13, weight: 'bold' },
            bodyFont: { family: 'Outfit', size: 12 },
            borderColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.03)' },
            ticks: { color: '#94a3b8', font: { family: 'Outfit' } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#94a3b8', font: { family: 'Outfit' } },
            title: { display: true, text: 'Net Başarısı', color: '#8b5cf6', font: { family: 'Outfit' } },
            min: 0,
            max: maxLimit
          }
        }
      }
    });
  }
};
