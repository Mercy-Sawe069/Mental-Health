// ===== NAVIGATION =====
function switchSection(name) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('section-' + name).classList.add('active');
    document.querySelector(`[data-section="${name}"]`).classList.add('active');
    const titles = { dashboard: 'Dashboard Overview', assessment: 'Risk Assessment', about: 'About MindGuard' };
    document.getElementById('page-title').textContent = titles[name];
    if (name === 'dashboard') loadStats();
}

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
        e.preventDefault();
        switchSection(item.dataset.section);
    });
});

// ===== CHARTS =====
let donutChart, barChart, gaugeChart;

function initDashboardCharts(data) {
    const donutCtx = document.getElementById('riskDonutChart').getContext('2d');
    const barCtx = document.getElementById('indicatorBarChart').getContext('2d');

    if (donutChart) donutChart.destroy();
    if (barChart) barChart.destroy();

    const hasData = data.total > 0;

    donutChart = new Chart(donutCtx, {
        type: 'doughnut',
        data: {
            labels: ['At Risk', 'Low Risk'],
            datasets: [{
                data: hasData ? [data.at_risk, data.low_risk] : [1, 1],
                backgroundColor: ['rgba(239,68,68,0.8)', 'rgba(34,197,94,0.8)'],
                borderColor: ['#ef4444', '#22c55e'],
                borderWidth: 2,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { position: 'bottom', labels: { color: '#8892a4', padding: 16, font: { size: 12 } } },
                tooltip: { enabled: hasData }
            }
        }
    });

    const indicatorLabels = ['0', '1', '2', '3', '4', '5', '6', '7', '8'];
    barChart = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: indicatorLabels.map(l => l + ' indicators'),
            datasets: [{
                label: 'Assessments',
                data: data.indicator_distribution,
                backgroundColor: indicatorLabels.map((_, i) =>
                    i < 4 ? 'rgba(34,197,94,0.7)' : 'rgba(239,68,68,0.7)'
                ),
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#8892a4', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#8892a4', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true }
            }
        }
    });
}

async function loadStats() {
    try {
        const res = await fetch('/stats');
        const data = await res.json();
        document.getElementById('stat-total').textContent = data.total;
        document.getElementById('stat-at-risk').textContent = data.at_risk;
        document.getElementById('stat-low-risk').textContent = data.low_risk;
        document.getElementById('stat-rate').textContent = data.at_risk_pct + '%';
        initDashboardCharts(data);
    } catch (e) {
        console.error('Failed to load stats', e);
    }
}

// ===== GAUGE CHART =====
function drawGauge(score) {
    const canvas = document.getElementById('gaugeChart');
    const ctx = canvas.getContext('2d');
    const cx = canvas.width / 2, cy = canvas.height - 10;
    const r = 100;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background arc
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 0);
    ctx.lineWidth = 18;
    ctx.strokeStyle = '#22263a';
    ctx.stroke();

    // Score arc
    const angle = Math.PI + (score / 100) * Math.PI;
    const color = score < 30 ? '#22c55e' : score < 60 ? '#f97316' : '#ef4444';
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, angle);
    ctx.lineWidth = 18;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.stroke();

    document.getElementById('gauge-score').textContent = score;
    document.getElementById('gauge-score').style.color = color;
}

// ===== ASSESSMENT FORM =====
document.getElementById('prediction-form').addEventListener('submit', async function (e) {
    e.preventDefault();

    const btnText = document.getElementById('btn-text');
    const btnLoader = document.getElementById('btn-loader');
    btnText.classList.add('hidden');
    btnLoader.classList.remove('hidden');

    const formData = {
        occupation: document.getElementById('occupation').value,
        family_history: document.getElementById('family_history').value,
        care_options: document.getElementById('care_options').value,
        mental_health_history: document.getElementById('mental_health_history').value,
        mood_swings: document.getElementById('mood_swings').value,
        days_indoors: document.getElementById('days_indoors').value,
        work_interest: document.getElementById('work_interest').value,
        changes_habits: document.getElementById('changes_habits').value
    };

    try {
        const response = await fetch('/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (!response.ok) {
            alert(result.error || 'Assessment failed. Please try again.');
            return;
        }

        // Show result panel
        document.getElementById('form-panel').classList.add('hidden');
        const resultPanel = document.getElementById('result-panel');
        resultPanel.classList.remove('hidden');

        // Draw gauge
        drawGauge(result.risk_score);

        // Risk badge
        const badge = document.getElementById('risk-badge');
        badge.textContent = result.risk_level + ' Risk';
        badge.className = 'risk-badge risk-' + result.risk_level.toLowerCase();

        // Summary
        document.getElementById('result-summary-text').textContent = result.summary;
        document.getElementById('result-recommendation-text').textContent = result.recommendation;

        // Factors
        const factorsList = document.getElementById('factors-list');
        factorsList.innerHTML = '';
        if (result.active_factors.length === 0) {
            factorsList.innerHTML = '<span class="no-factors">✓ No significant risk factors detected</span>';
        } else {
            result.active_factors.forEach(f => {
                const chip = document.createElement('span');
                chip.className = 'factor-chip';
                chip.textContent = f;
                factorsList.appendChild(chip);
            });
        }

    } catch (err) {
        alert('Service unavailable. Please try again later.');
    } finally {
        btnText.classList.remove('hidden');
        btnLoader.classList.add('hidden');
    }
});

document.getElementById('new-assessment-btn').addEventListener('click', function () {
    document.getElementById('prediction-form').reset();
    document.getElementById('result-panel').classList.add('hidden');
    document.getElementById('form-panel').classList.remove('hidden');
});

// ===== INIT =====
loadStats();
