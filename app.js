class PricingSimulator {
    constructor() {
        this.articles = [];
        this.writers = new Set();
        this.configuration = {
            globalDefaults: {
                baseline: { model: 'PW', params: { rate: 0.13 }, bonusPercent: 0 },
                simulation: { model: 'PW', params: { rate: 0.13 }, bonusPercent: 0 }
            },
            writerOverrides: {}
        };
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        const dropZone = document.getElementById('dropZone');
        const csvFile = document.getElementById('csvFile');
        
        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('dragover');
            });
            
            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('dragover');
            });
            
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('dragover');
                const file = e.dataTransfer.files[0];
                if (file && file.type === 'text/csv') {
                    this.processCSV(file);
                }
            });
        }
        
        if (csvFile) {
            csvFile.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.processCSV(file);
                }
            });
        }

        const globalBaselineModel = document.getElementById('globalBaselineModel');
        if (globalBaselineModel) {
            globalBaselineModel.addEventListener('change', (e) => {
                this.updateModelParams('globalBaselineParams', e.target.value);
            });
        }
        
        const globalSimulationModel = document.getElementById('globalSimulationModel');
        if (globalSimulationModel) {
            globalSimulationModel.addEventListener('change', (e) => {
                this.updateModelParams('globalSimulationParams', e.target.value);
            });
        }

        const applyConfig = document.getElementById('applyConfig');
        if (applyConfig) {
            applyConfig.addEventListener('click', () => {
                this.applyConfiguration();
            });
        }

        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterDataGrid(e.target.value);
            });
        }

        this.updateModelParams('globalBaselineParams', 'PW');
        this.updateModelParams('globalSimulationParams', 'PW');
    }

    processCSV(file) {
        Papa.parse(file, {
            header: true,
            complete: (results) => {
                try {
                    this.parseArticles(results.data);
                    this.showFeedback('success', `✓ ${this.articles.length} articles importés avec succès`);
                    document.getElementById('configSection').style.display = 'block';
                    this.populateWriterConfigs();
                    this.calculateAndDisplay();
                } catch (error) {
                    this.showFeedback('error', `✗ Erreur lors de l'import: ${error.message}`);
                }
            },
            error: (error) => {
                this.showFeedback('error', `✗ Erreur lors de la lecture du fichier: ${error.message}`);
            }
        });
    }

    parseArticles(data) {
        this.articles = [];
        this.writers = new Set();
        
        data.forEach((row, index) => {
            if (!row['Word Count'] || !row['Writer'] || !row['Publish Date']) {
                return;
            }
            
            const article = {
                url: row['URL'] || '',
                writer: row['Writer'].trim(),
                publishDate: this.parseDate(row['Publish Date']),
                wordCount: parseInt(row['Word Count'], 10)
            };
            
            if (!isNaN(article.wordCount) && article.publishDate) {
                this.articles.push(article);
                this.writers.add(article.writer);
            }
        });
        
        if (this.articles.length === 0) {
            throw new Error('Aucun article valide trouvé dans le fichier');
        }
    }

    parseDate(dateStr) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            const date = new Date(year, month, day);
            if (!isNaN(date.getTime())) {
                return date;
            }
        }
        return null;
    }

    showFeedback(type, message) {
        const feedback = document.getElementById('uploadFeedback');
        feedback.textContent = message;
        feedback.className = `feedback-message ${type}`;
        setTimeout(() => {
            feedback.className = 'feedback-message';
        }, 5000);
    }

    updateModelParams(containerId, model) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        
        const params = this.getModelParams(model);
        params.forEach(param => {
            const group = document.createElement('div');
            group.className = 'form-group';
            group.innerHTML = `
                <label>${param.label}:</label>
                <input type="number" 
                       data-param="${param.key}" 
                       value="${param.defaultValue}" 
                       step="${param.step || 0.01}"
                       min="0">
            `;
            container.appendChild(group);
        });
    }

    getModelParams(model) {
        const params = {
            'PW': [
                { label: 'Tarif (€/mot)', key: 'rate', defaultValue: 0.13, step: 0.001 }
            ],
            'FP': [
                { label: 'Montant Fixe (€)', key: 'fixedAmount', defaultValue: 100, step: 1 }
            ],
            'HY': [
                { label: 'Frais de Base (€)', key: 'baseFee', defaultValue: 50, step: 1 },
                { label: 'Tarif Réduit (€/mot)', key: 'reducedRate', defaultValue: 0.08, step: 0.001 }
            ],
            'DMR': [
                { label: 'Tarif Standard (€/mot)', key: 'standardRate', defaultValue: 0.13, step: 0.001 },
                { label: 'Seuil (mots)', key: 'threshold', defaultValue: 1000, step: 100 },
                { label: 'Tarif Inférieur (€/mot)', key: 'lowerRate', defaultValue: 0.08, step: 0.001 }
            ],
            'CO': [
                { label: 'Montant Fixe (€)', key: 'fixedAmount', defaultValue: 500, step: 1 },
                { label: 'Cap (mots)', key: 'cap', defaultValue: 5000, step: 100 },
                { label: 'Tarif Dépassement (€/mot)', key: 'overageRate', defaultValue: 0.13, step: 0.001 }
            ]
        };
        return params[model] || [];
    }

    populateWriterConfigs() {
        const container = document.getElementById('writerConfigs');
        container.innerHTML = '';
        
        const writerStats = this.calculateWriterStatistics();
        
        Array.from(this.writers).sort().forEach(writer => {
            const stats = writerStats[writer];
            const config = document.createElement('div');
            config.className = 'writer-config-item';
            config.innerHTML = `
                <div class="writer-name">${writer}</div>
                <div style="font-size: 12px; color: #6B7280; margin-bottom: 12px;">
                    CV: ${stats.cv.toFixed(2)} | P75: ${stats.p75} mots
                </div>
                <div class="config-group">
                    <h4>Baseline</h4>
                    <div class="override-checkbox">
                        <input type="checkbox" id="baseline-override-${writer}" data-writer="${writer}" data-scenario="baseline">
                        <label for="baseline-override-${writer}">Personnaliser</label>
                    </div>
                    <div id="baseline-config-${writer}" style="display: none;">
                        <div class="form-group">
                            <label>Modèle:</label>
                            <select data-writer="${writer}" data-scenario="baseline" class="writer-model-select">
                                <option value="PW">Par Mot (PW)</option>
                                <option value="FP">Prix Fixe (FP)</option>
                                <option value="HY">Hybride (HY)</option>
                                <option value="DMR">Taux Marginal Décroissant (DMR)</option>
                                <option value="CO">Cap + Dépassement (C+O)</option>
                            </select>
                        </div>
                        <div id="baseline-params-${writer}" class="model-params"></div>
                        <div class="form-group">
                            <label>Bonus Qualité (%):</label>
                            <input type="number" class="writer-bonus" data-writer="${writer}" data-scenario="baseline" value="0" min="0" max="100" step="0.1">
                        </div>
                    </div>
                </div>
                <div class="config-group">
                    <h4>Simulation</h4>
                    <div class="override-checkbox">
                        <input type="checkbox" id="simulation-override-${writer}" data-writer="${writer}" data-scenario="simulation">
                        <label for="simulation-override-${writer}">Personnaliser</label>
                    </div>
                    <div id="simulation-config-${writer}" style="display: none;">
                        <div class="form-group">
                            <label>Modèle:</label>
                            <select data-writer="${writer}" data-scenario="simulation" class="writer-model-select">
                                <option value="PW">Par Mot (PW)</option>
                                <option value="FP">Prix Fixe (FP)</option>
                                <option value="HY">Hybride (HY)</option>
                                <option value="DMR">Taux Marginal Décroissant (DMR)</option>
                                <option value="CO">Cap + Dépassement (C+O)</option>
                            </select>
                        </div>
                        <div id="simulation-params-${writer}" class="model-params"></div>
                        <div class="form-group">
                            <label>Bonus Qualité (%):</label>
                            <input type="number" class="writer-bonus" data-writer="${writer}" data-scenario="simulation" value="0" min="0" max="100" step="0.1">
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(config);

            const baselineCheckbox = config.querySelector(`#baseline-override-${writer}`);
            const simulationCheckbox = config.querySelector(`#simulation-override-${writer}`);
            
            baselineCheckbox.addEventListener('change', (e) => {
                const configDiv = document.getElementById(`baseline-config-${writer}`);
                configDiv.style.display = e.target.checked ? 'block' : 'none';
                if (e.target.checked) {
                    this.updateModelParams(`baseline-params-${writer}`, 'PW');
                }
            });
            
            simulationCheckbox.addEventListener('change', (e) => {
                const configDiv = document.getElementById(`simulation-config-${writer}`);
                configDiv.style.display = e.target.checked ? 'block' : 'none';
                if (e.target.checked) {
                    const suggestedModel = stats.cv < 0.3 ? 'CO' : 'PW';
                    const select = config.querySelector(`select[data-writer="${writer}"][data-scenario="simulation"]`);
                    select.value = suggestedModel;
                    this.updateWriterModelParams(writer, 'simulation', suggestedModel, stats);
                }
            });

            config.querySelectorAll('.writer-model-select').forEach(select => {
                select.addEventListener('change', (e) => {
                    const writer = e.target.dataset.writer;
                    const scenario = e.target.dataset.scenario;
                    this.updateWriterModelParams(writer, scenario, e.target.value, stats);
                });
            });
        });
    }

    updateWriterModelParams(writer, scenario, model, stats) {
        const container = document.getElementById(`${scenario}-params-${writer}`);
        container.innerHTML = '';
        
        let params = this.getModelParams(model);
        
        if (model === 'CO' && stats) {
            params = [
                { label: 'Montant Fixe (€)', key: 'fixedAmount', defaultValue: Math.round(stats.p75 * 0.13), step: 1 },
                { label: 'Cap (mots)', key: 'cap', defaultValue: stats.p75, step: 100 },
                { label: 'Tarif Dépassement (€/mot)', key: 'overageRate', defaultValue: 0.13, step: 0.001 }
            ];
        }
        
        params.forEach(param => {
            const group = document.createElement('div');
            group.className = 'form-group';
            group.innerHTML = `
                <label>${param.label}:</label>
                <input type="number" 
                       data-param="${param.key}" 
                       value="${param.defaultValue}" 
                       step="${param.step || 0.01}"
                       min="0">
            `;
            container.appendChild(group);
        });
    }

    applyConfiguration() {
        this.configuration.globalDefaults.baseline = this.getGlobalConfig('baseline');
        this.configuration.globalDefaults.simulation = this.getGlobalConfig('simulation');
        
        this.configuration.writerOverrides = {};
        
        this.writers.forEach(writer => {
            const baselineOverride = document.getElementById(`baseline-override-${writer}`).checked;
            const simulationOverride = document.getElementById(`simulation-override-${writer}`).checked;
            
            if (baselineOverride || simulationOverride) {
                this.configuration.writerOverrides[writer] = {};
                
                if (baselineOverride) {
                    this.configuration.writerOverrides[writer].baseline = this.getWriterConfig(writer, 'baseline');
                }
                
                if (simulationOverride) {
                    this.configuration.writerOverrides[writer].simulation = this.getWriterConfig(writer, 'simulation');
                }
            }
        });
        
        this.calculateAndDisplay();
    }

    getGlobalConfig(scenario) {
        const modelSelect = document.getElementById(`global${scenario.charAt(0).toUpperCase() + scenario.slice(1)}Model`);
        const bonusInput = document.getElementById(`global${scenario.charAt(0).toUpperCase() + scenario.slice(1)}Bonus`);
        const paramsContainer = document.getElementById(`global${scenario.charAt(0).toUpperCase() + scenario.slice(1)}Params`);
        
        const config = {
            model: modelSelect.value,
            params: {},
            bonusPercent: parseFloat(bonusInput.value) || 0
        };
        
        paramsContainer.querySelectorAll('input').forEach(input => {
            const param = input.dataset.param;
            config.params[param] = parseFloat(input.value) || 0;
        });
        
        return config;
    }

    calculateCost(wordCount, config) {
        let modelCost = 0;
        
        switch (config.model) {
            case 'PW':
                modelCost = wordCount * config.params.rate;
                break;
            case 'FP':
                modelCost = config.params.fixedAmount;
                break;
            case 'HY':
                modelCost = config.params.baseFee + (wordCount * config.params.reducedRate);
                break;
            case 'DMR':
                if (wordCount <= config.params.threshold) {
                    modelCost = wordCount * config.params.standardRate;
                } else {
                    modelCost = (config.params.threshold * config.params.standardRate) + 
                               ((wordCount - config.params.threshold) * config.params.lowerRate);
                }
                break;
            case 'CO':
                if (wordCount <= config.params.cap) {
                    modelCost = config.params.fixedAmount;
                } else {
                    modelCost = config.params.fixedAmount + 
                               ((wordCount - config.params.cap) * config.params.overageRate);
                }
                break;
        }
        
        const finalCost = modelCost * (1 + (config.bonusPercent / 100));
        return finalCost;
    }

    getWriterConfigForCalculation(writer, scenario) {
        const override = this.configuration.writerOverrides[writer];
        if (override && override[scenario]) {
            return override[scenario];
        }
        return this.configuration.globalDefaults[scenario];
    }

    calculateAndDisplay() {
        this.articles.forEach(article => {
            const baselineConfig = this.getWriterConfigForCalculation(article.writer, 'baseline');
            const simulationConfig = this.getWriterConfigForCalculation(article.writer, 'simulation');
            
            article.baselineCost = this.calculateCost(article.wordCount, baselineConfig);
            article.simulationCost = this.calculateCost(article.wordCount, simulationConfig);
        });
        
        this.updateDashboard();
        this.updateDataGrid();
        this.updateCharts();
    }

    calculateWriterStatistics() {
        const stats = {};
        
        this.writers.forEach(writer => {
            const writerArticles = this.articles.filter(a => a.writer === writer);
            const wordCounts = writerArticles.map(a => a.wordCount).sort((a, b) => a - b);
            
            if (wordCounts.length > 0) {
                const mean = ss.mean(wordCounts);
                const stdDev = wordCounts.length > 1 ? ss.standardDeviation(wordCounts) : 0;
                const cv = mean > 0 ? stdDev / mean : 0;
                
                stats[writer] = {
                    count: wordCounts.length,
                    mean: Math.round(mean),
                    median: Math.round(ss.median(wordCounts)),
                    cv: cv,
                    p25: Math.round(ss.quantile(wordCounts, 0.25)),
                    p75: Math.round(ss.quantile(wordCounts, 0.75)),
                    stdDev: stdDev
                };
            }
        });
        
        return stats;
    }

    updateDashboard() {
        const totalArticles = this.articles.length;
        const wordCounts = this.articles.map(a => a.wordCount);
        const avgWordCount = Math.round(ss.mean(wordCounts));
        const medianWordCount = Math.round(ss.median(wordCounts));
        const stdDev = ss.standardDeviation(wordCounts);
        const globalCV = avgWordCount > 0 ? (stdDev / avgWordCount).toFixed(2) : '0.00';
        
        document.getElementById('totalArticles').textContent = totalArticles.toLocaleString('fr-FR');
        document.getElementById('avgWordCount').textContent = avgWordCount.toLocaleString('fr-FR');
        document.getElementById('medianWordCount').textContent = medianWordCount.toLocaleString('fr-FR');
        document.getElementById('globalCV').textContent = globalCV;
        
        const totalBaselineCost = this.articles.reduce((sum, a) => sum + a.baselineCost, 0);
        const totalSimulationCost = this.articles.reduce((sum, a) => sum + a.simulationCost, 0);
        const avgBaselineCost = totalBaselineCost / totalArticles;
        const avgSimulationCost = totalSimulationCost / totalArticles;
        const savings = totalSimulationCost - totalBaselineCost;
        const savingsPercent = totalBaselineCost > 0 ? (savings / totalBaselineCost) * 100 : 0;
        
        document.getElementById('totalCostBaseline').textContent = `${totalBaselineCost.toFixed(2)} €`;
        document.getElementById('totalCostSimulation').textContent = `${totalSimulationCost.toFixed(2)} €`;
        document.getElementById('avgCostBaseline').textContent = `${avgBaselineCost.toFixed(2)} €`;
        document.getElementById('avgCostSimulation').textContent = `${avgSimulationCost.toFixed(2)} €`;
        document.getElementById('totalSavings').textContent = `${savings > 0 ? '+' : ''}${savings.toFixed(2)} €`;
        document.getElementById('savingsPercent').textContent = `${savingsPercent > 0 ? '+' : ''}${savingsPercent.toFixed(1)}%`;
        
        const savingsCard = document.querySelector('.comparison-card.highlight');
        if (savings < 0) {
            savingsCard.style.background = 'linear-gradient(135deg, #10B981, #059669)';
        } else {
            savingsCard.style.background = 'linear-gradient(135deg, #0EA5E9, #0284C7)';
        }
        
        this.updateWriterTable();
    }

    updateWriterTable() {
        const tbody = document.getElementById('writerTableBody');
        tbody.innerHTML = '';
        
        const writerStats = this.calculateWriterStatistics();
        
        this.writers.forEach(writer => {
            const stats = writerStats[writer];
            const writerArticles = this.articles.filter(a => a.writer === writer);
            
            const totalWords = writerArticles.reduce((sum, a) => sum + a.wordCount, 0);
            const totalBaselineCost = writerArticles.reduce((sum, a) => sum + a.baselineCost, 0);
            const totalSimulationCost = writerArticles.reduce((sum, a) => sum + a.simulationCost, 0);
            const difference = ((totalSimulationCost - totalBaselineCost) / totalBaselineCost) * 100;
            const effectiveRateBaseline = totalWords > 0 ? totalBaselineCost / totalWords : 0;
            const effectiveRateSimulation = totalWords > 0 ? totalSimulationCost / totalWords : 0;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${writer}</td>
                <td>${stats.count}</td>
                <td>${stats.mean.toLocaleString('fr-FR')}</td>
                <td>${stats.cv.toFixed(2)}</td>
                <td>${stats.p25.toLocaleString('fr-FR')}</td>
                <td>${stats.p75.toLocaleString('fr-FR')}</td>
                <td>${totalBaselineCost.toFixed(2)} €</td>
                <td>${totalSimulationCost.toFixed(2)} €</td>
                <td style="color: ${difference < 0 ? '#10B981' : '#EF4444'}">${difference > 0 ? '+' : ''}${difference.toFixed(1)}%</td>
                <td>${effectiveRateBaseline.toFixed(3)} €</td>
                <td>${effectiveRateSimulation.toFixed(3)} €</td>
            `;
            tbody.appendChild(row);
        });
    }

    updateDataGrid() {
        const tbody = document.getElementById('articleTableBody');
        tbody.innerHTML = '';
        
        this.articles.forEach(article => {
            const difference = article.simulationCost - article.baselineCost;
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${article.url}</td>
                <td>${article.writer}</td>
                <td>${article.publishDate.toLocaleDateString('fr-FR')}</td>
                <td>${article.wordCount.toLocaleString('fr-FR')}</td>
                <td>${article.baselineCost.toFixed(2)} €</td>
                <td>${article.simulationCost.toFixed(2)} €</td>
                <td style="color: ${difference < 0 ? '#10B981' : '#EF4444'}">${difference > 0 ? '+' : ''}${difference.toFixed(2)} €</td>
            `;
            tbody.appendChild(row);
        });
    }

    updateCharts() {
        this.updateWordCountTrendChart();
        this.updateCostComparisonChart();
    }

    updateWordCountTrendChart() {
        const canvas = document.getElementById('wordCountTrendChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        const monthlyData = {};
        this.articles.forEach(article => {
            const monthKey = `${article.publishDate.getFullYear()}-${String(article.publishDate.getMonth() + 1).padStart(2, '0')}`;
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = { count: 0, totalWords: 0 };
            }
            monthlyData[monthKey].count++;
            monthlyData[monthKey].totalWords += article.wordCount;
        });
        
        const sortedMonths = Object.keys(monthlyData).sort();
        const labels = sortedMonths.map(month => {
            const [year, monthNum] = month.split('-');
            return new Date(year, monthNum - 1).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
        });
        
        const avgWordCounts = sortedMonths.map(month => 
            Math.round(monthlyData[month].totalWords / monthlyData[month].count)
        );
        
        if (window.wordCountChart) {
            window.wordCountChart.destroy();
        }
        
        window.wordCountChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Nombre de mots moyen',
                    data: avgWordCounts,
                    borderColor: '#0EA5E9',
                    backgroundColor: 'rgba(14, 165, 233, 0.1)',
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        title: {
                            display: true,
                            text: 'Nombre de mots'
                        }
                    }
                }
            }
        });
    }

    updateCostComparisonChart() {
        const canvas = document.getElementById('costComparisonChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        const writerData = [];
        this.writers.forEach(writer => {
            const writerArticles = this.articles.filter(a => a.writer === writer);
            const totalBaselineCost = writerArticles.reduce((sum, a) => sum + a.baselineCost, 0);
            const totalSimulationCost = writerArticles.reduce((sum, a) => sum + a.simulationCost, 0);
            writerData.push({
                writer: writer,
                baseline: totalBaselineCost,
                simulation: totalSimulationCost
            });
        });
        
        writerData.sort((a, b) => (b.baseline + b.simulation) - (a.baseline + a.simulation));
        const topWriters = writerData.slice(0, 10);
        
        if (window.costComparisonChart) {
            window.costComparisonChart.destroy();
        }
        
        window.costComparisonChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: topWriters.map(w => w.writer),
                datasets: [
                    {
                        label: 'Baseline',
                        data: topWriters.map(w => w.baseline.toFixed(2)),
                        backgroundColor: '#94A3B8'
                    },
                    {
                        label: 'Simulation',
                        data: topWriters.map(w => w.simulation.toFixed(2)),
                        backgroundColor: '#0EA5E9'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Coût Total (€)'
                        }
                    }
                }
            }
        });
    }

    filterDataGrid(searchTerm) {
        const rows = document.querySelectorAll('#articleTableBody tr');
        const term = searchTerm.toLowerCase();
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(term) ? '' : 'none';
        });
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.remove('active');
        });
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        
        document.querySelector(`.tab-button[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(tabName).classList.add('active');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new PricingSimulator();
});