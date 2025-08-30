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
        this.sortState = {
            writerStatsTable: { column: null, direction: 'asc' },
            writerCostTable: { column: null, direction: 'asc' },
            articleTable: { column: null, direction: 'asc' }
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

        // Modal controls
        const openModalBtn = document.getElementById('openConfigModal');
        const closeModalBtn = document.getElementById('closeConfigModal');
        const cancelConfigBtn = document.getElementById('cancelConfig');
        const applyConfigBtn = document.getElementById('applyConfig');
        const modal = document.getElementById('configModal');
        
        if (openModalBtn) {
            openModalBtn.addEventListener('click', () => {
                this.openConfigModal();
            });
        }
        
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => {
                this.closeConfigModal();
            });
        }
        
        if (cancelConfigBtn) {
            cancelConfigBtn.addEventListener('click', () => {
                this.closeConfigModal();
            });
        }
        
        if (applyConfigBtn) {
            applyConfigBtn.addEventListener('click', () => {
                this.applyConfiguration();
                this.closeConfigModal();
            });
        }
        
        // Config tabs
        document.querySelectorAll('.config-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchConfigTab(e.target.dataset.config);
            });
        });
        
        // Model selection
        document.querySelectorAll('input[name="baseline-model"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.updateModalModelParams('baseline', e.target.value);
                this.updatePreview();
            });
        });
        
        document.querySelectorAll('input[name="simulation-model"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.updateModalModelParams('simulation', e.target.value);
                this.updatePreview();
            });
        })

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
        
        // Initialize table sorting
        this.initializeTableSorting();

        // Initialize default model parameters
        this.tempConfig = {
            baseline: { model: 'PW', params: { rate: 0.13 }, bonusPercent: 0 },
            simulation: { model: 'PW', params: { rate: 0.13 }, bonusPercent: 0 },
            writerOverrides: {}
        };
    }

    processCSV(file) {
        Papa.parse(file, {
            header: true,
            complete: (results) => {
                try {
                    this.parseArticles(results.data);
                    this.showFeedback('success', `${this.articles.length} articles importés avec succès`);
                    document.getElementById('configSection').style.display = 'block';
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

    updateWriterModelParams(writer, scenario, model, statsParam) {
        const container = document.getElementById(`${scenario}-params-${writer}`);
        if (!container) return;
        
        container.innerHTML = '';
        
        // Get stats if not provided
        let stats = statsParam;
        if (!stats) {
            const writerStats = this.calculateWriterStatistics();
            stats = writerStats[writer];
        }
        
        let params = this.getModelParamsForModal(model);
        
        // Adjust defaults for CO model based on writer's P75
        if (model === 'CO' && stats) {
            params = [
                { label: 'Prix fixe (€)', key: 'fixedAmount', defaultValue: Math.round(stats.p75 * 0.11), step: 1, help: 'Montant pour articles normaux' },
                { label: 'Plafond (mots)', key: 'cap', defaultValue: stats.p75, step: 100, help: `Basé sur votre P75: ${stats.p75} mots` },
                { label: 'Tarif dépassement (€/mot)', key: 'overageRate', defaultValue: 0.13, step: 0.001, help: 'Prix au-delà du plafond' }
            ];
        }
        
        const paramGroup = document.createElement('div');
        paramGroup.style.padding = '12px';
        paramGroup.style.background = '#f9fafb';
        paramGroup.style.borderRadius = '6px';
        paramGroup.style.marginTop = '8px';
        
        params.forEach(param => {
            const field = document.createElement('div');
            field.style.marginBottom = '12px';
            field.innerHTML = `
                <label style="display: block; font-size: 12px; margin-bottom: 4px; color: #6b7280;">${param.label}</label>
                <input type="number" 
                       data-scenario="${scenario}"
                       data-writer="${writer}"
                       data-param="${param.key}" 
                       value="${param.defaultValue}" 
                       step="${param.step || 0.01}"
                       min="0"
                       style="width: 100%; padding: 6px 8px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 13px;"
                       class="writer-param-input">
                ${param.help ? `<div style="font-size: 11px; color: #9ca3af; margin-top: 2px;">${param.help}</div>` : ''}
            `;
            paramGroup.appendChild(field);
        });
        
        container.appendChild(paramGroup);
        
        // Add change listeners
        container.querySelectorAll('.writer-param-input').forEach(input => {
            input.addEventListener('input', () => {
                this.updateTempConfigFromModal();
                this.updatePreview();
            });
        });
    }

    applyConfiguration() {
        // Copy temp config to actual config
        this.configuration.globalDefaults = {
            baseline: { ...this.tempConfig.baseline },
            simulation: { ...this.tempConfig.simulation }
        };
        this.configuration.writerOverrides = { ...this.tempConfig.writerOverrides };
        
        this.calculateAndDisplay();
        this.showFeedback('success', 'Configuration appliquée avec succès');
        this.updateConfigSummary();
    }
    
    updateConfigSummary() {
        const summary = document.getElementById('configSummaryContent');
        const container = document.getElementById('currentConfigSummary');
        
        if (!summary || !container) return;
        
        container.style.display = 'block';
        
        const baselineModel = this.getModelName(this.configuration.globalDefaults.baseline.model);
        const simulationModel = this.getModelName(this.configuration.globalDefaults.simulation.model);
        
        const overrideCount = Object.keys(this.configuration.writerOverrides).length;
        
        // Count baseline and simulation overrides
        let baselineOverrides = 0;
        let simulationOverrides = 0;
        Object.values(this.configuration.writerOverrides).forEach(override => {
            if (override.baseline) baselineOverrides++;
            if (override.simulation) simulationOverrides++;
        });
        
        summary.innerHTML = `
            <div><strong>Référence:</strong> ${baselineModel}</div>
            ${baselineOverrides > 0 ? `<div style="margin-left: 20px; font-size: 0.9em; color: #6B7280;">${baselineOverrides} personnalisation(s)</div>` : ''}
            <div><strong>Simulation:</strong> ${simulationModel}</div>
            ${simulationOverrides > 0 ? `<div style="margin-left: 20px; font-size: 0.9em; color: #6B7280;">${simulationOverrides} personnalisation(s)</div>` : ''}
        `;
    }
    
    getModelName(model) {
        const names = {
            'PW': 'Tarif au volume',
            'FP': 'Prix fixe',
            'HY': 'Modèle hybride',
            'DMR': 'Tarif dégressif',
            'CO': 'Prix plafonné'
        };
        return names[model] || model;
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
        
        // Debug: Check if configurations are different
        const firstArticle = this.articles[0];
        if (firstArticle) {
            console.log('Configuration comparison:');
            console.log('Global baseline config:', this.configuration.globalDefaults.baseline);
            console.log('Global simulation config:', this.configuration.globalDefaults.simulation);
            console.log('Writer overrides:', this.configuration.writerOverrides);
            console.log('Sample costs - Baseline:', firstArticle.baselineCost.toFixed(2), 'Simulation:', firstArticle.simulationCost.toFixed(2));
            
            // Show which writers have overrides
            const overriddenWriters = Object.keys(this.configuration.writerOverrides);
            if (overriddenWriters.length > 0) {
                console.log('Writers with custom pricing:', overriddenWriters);
            }
        }
        
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
                const mean = this.calculateMean(wordCounts);
                const stdDev = wordCounts.length > 1 ? this.calculateStdDev(wordCounts, mean) : 0;
                const cv = mean > 0 ? stdDev / mean : 0;
                
                stats[writer] = {
                    count: wordCounts.length,
                    mean: Math.round(mean),
                    median: Math.round(this.calculateMedian(wordCounts)),
                    cv: cv,
                    p25: Math.round(this.calculatePercentile(wordCounts, 0.25)),
                    p75: Math.round(this.calculatePercentile(wordCounts, 0.75)),
                    stdDev: stdDev
                };
            }
        });
        
        return stats;
    }
    
    calculateMean(values) {
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    }
    
    calculateMedian(sortedValues) {
        const mid = Math.floor(sortedValues.length / 2);
        return sortedValues.length % 2 !== 0
            ? sortedValues[mid]
            : (sortedValues[mid - 1] + sortedValues[mid]) / 2;
    }
    
    calculateStdDev(values, mean) {
        const squareDiffs = values.map(value => Math.pow(value - mean, 2));
        const avgSquareDiff = this.calculateMean(squareDiffs);
        return Math.sqrt(avgSquareDiff);
    }
    
    calculatePercentile(sortedValues, percentile) {
        const index = percentile * (sortedValues.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        const weight = index % 1;
        
        if (lower === upper) {
            return sortedValues[lower];
        }
        
        return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
    }

    updateDashboard() {
        const totalArticles = this.articles.length;
        
        if (totalArticles === 0) {
            document.getElementById('totalArticles').textContent = '0';
            document.getElementById('avgWordCount').textContent = '-';
            document.getElementById('medianWordCount').textContent = '-';
            document.getElementById('globalCV').textContent = '-';
            return;
        }
        
        const wordCounts = this.articles.map(a => a.wordCount).sort((a, b) => a - b);
        const avgWordCount = Math.round(this.calculateMean(wordCounts));
        const medianWordCount = Math.round(this.calculateMedian(wordCounts));
        const stdDev = this.calculateStdDev(wordCounts, this.calculateMean(wordCounts));
        const globalCV = avgWordCount > 0 ? (stdDev / avgWordCount).toFixed(2) : '0.00';
        
        document.getElementById('totalArticles').textContent = totalArticles.toLocaleString('fr-FR');
        document.getElementById('avgWordCount').textContent = avgWordCount.toLocaleString('fr-FR');
        document.getElementById('medianWordCount').textContent = medianWordCount.toLocaleString('fr-FR');
        document.getElementById('globalCV').textContent = globalCV;
        
        const totalBaselineCost = this.articles.reduce((sum, a) => sum + a.baselineCost, 0);
        const totalSimulationCost = this.articles.reduce((sum, a) => sum + a.simulationCost, 0);
        const avgBaselineCost = totalBaselineCost / totalArticles;
        const avgSimulationCost = totalSimulationCost / totalArticles;
        
        // Calculate median costs
        const baselineCosts = this.articles.map(a => a.baselineCost).sort((a, b) => a - b);
        const simulationCosts = this.articles.map(a => a.simulationCost).sort((a, b) => a - b);
        const medianBaselineCost = this.calculateMedian(baselineCosts);
        const medianSimulationCost = this.calculateMedian(simulationCosts);
        
        const savings = totalSimulationCost - totalBaselineCost;
        const savingsPercent = totalBaselineCost > 0 ? (savings / totalBaselineCost) * 100 : 0;
        
        document.getElementById('totalCostBaseline').textContent = `${totalBaselineCost.toFixed(2)} €`;
        document.getElementById('totalCostSimulation').textContent = `${totalSimulationCost.toFixed(2)} €`;
        document.getElementById('avgCostBaseline').textContent = `${avgBaselineCost.toFixed(2)} €`;
        document.getElementById('avgCostSimulation').textContent = `${avgSimulationCost.toFixed(2)} €`;
        document.getElementById('medianCostBaseline').textContent = `${medianBaselineCost.toFixed(2)} €`;
        document.getElementById('medianCostSimulation').textContent = `${medianSimulationCost.toFixed(2)} €`;
        document.getElementById('totalSavings').textContent = `${savings > 0 ? '+' : ''}${savings.toFixed(2)} €`;
        document.getElementById('savingsPercent').textContent = `${savingsPercent > 0 ? '+' : ''}${savingsPercent.toFixed(1)}%`;
        
        const savingsCard = document.querySelector('.comparison-card.highlight');
        if (savings < 0) {
            savingsCard.style.background = 'linear-gradient(135deg, #10B981, #059669)';
        } else {
            savingsCard.style.background = 'linear-gradient(135deg, #0EA5E9, #0284C7)';
        }
        
        this.updateWriterStatsTable();
        this.updateWriterCostTable();
    }

    updateWriterStatsTable() {
        const tbody = document.getElementById('writerStatsTableBody');
        tbody.innerHTML = '';
        
        const writerStats = this.calculateWriterStatistics();
        
        // Prepare data for sorting
        const writerData = [];
        this.writers.forEach(writer => {
            const stats = writerStats[writer];
            
            writerData.push({
                writer: writer,
                articles: stats.count,
                avgWords: stats.mean,
                cv: stats.cv,
                p25: stats.p25,
                p75: stats.p75
            });
        });
        
        // Apply sorting if a column is selected
        if (this.sortState.writerStatsTable.column) {
            const column = this.sortState.writerStatsTable.column;
            const direction = this.sortState.writerStatsTable.direction;
            
            writerData.sort((a, b) => {
                let aVal = a[column];
                let bVal = b[column];
                
                // Handle string vs number comparison
                if (typeof aVal === 'string') {
                    aVal = aVal.toLowerCase();
                    bVal = bVal.toLowerCase();
                }
                
                if (direction === 'asc') {
                    return aVal > bVal ? 1 : (aVal < bVal ? -1 : 0);
                } else {
                    return aVal < bVal ? 1 : (aVal > bVal ? -1 : 0);
                }
            });
        }
        
        // Render sorted data
        writerData.forEach(data => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${data.writer}</td>
                <td>${data.articles}</td>
                <td>${data.avgWords.toLocaleString('fr-FR')}</td>
                <td>${data.cv.toFixed(2)}</td>
                <td>${data.p25.toLocaleString('fr-FR')}</td>
                <td>${data.p75.toLocaleString('fr-FR')}</td>
            `;
            tbody.appendChild(row);
        });
    }
    
    updateWriterCostTable() {
        const tbody = document.getElementById('writerCostTableBody');
        tbody.innerHTML = '';
        
        // Prepare data for sorting
        const costData = [];
        this.writers.forEach(writer => {
            const writerArticles = this.articles.filter(a => a.writer === writer);
            
            const totalWords = writerArticles.reduce((sum, a) => sum + a.wordCount, 0);
            const totalBaselineCost = writerArticles.reduce((sum, a) => sum + a.baselineCost, 0);
            const totalSimulationCost = writerArticles.reduce((sum, a) => sum + a.simulationCost, 0);
            
            // Calculate average and median costs per article
            const baselineCostsForWriter = writerArticles.map(a => a.baselineCost).sort((a, b) => a - b);
            const simulationCostsForWriter = writerArticles.map(a => a.simulationCost).sort((a, b) => a - b);
            const avgCostBaseline = writerArticles.length > 0 ? totalBaselineCost / writerArticles.length : 0;
            const avgCostSimulation = writerArticles.length > 0 ? totalSimulationCost / writerArticles.length : 0;
            const medianCostBaseline = writerArticles.length > 0 ? this.calculateMedian(baselineCostsForWriter) : 0;
            const medianCostSimulation = writerArticles.length > 0 ? this.calculateMedian(simulationCostsForWriter) : 0;
            
            // Calculate effective rates (cost per word)
            const effectiveRateBaseline = totalWords > 0 ? totalBaselineCost / totalWords : 0;
            const effectiveRateSimulation = totalWords > 0 ? totalSimulationCost / totalWords : 0;
            
            const difference = totalBaselineCost > 0 ? ((totalSimulationCost - totalBaselineCost) / totalBaselineCost) * 100 : 0;
            const savings = totalBaselineCost - totalSimulationCost;
            
            costData.push({
                writer: writer,
                avgCostBaseline: avgCostBaseline,
                medianCostBaseline: medianCostBaseline,
                baselineCost: totalBaselineCost,
                effectiveRateBaseline: effectiveRateBaseline,
                avgCostSimulation: avgCostSimulation,
                medianCostSimulation: medianCostSimulation,
                simulationCost: totalSimulationCost,
                effectiveRateSimulation: effectiveRateSimulation,
                difference: difference,
                savings: savings
            });
        });
        
        // Apply sorting if a column is selected
        if (this.sortState.writerCostTable.column) {
            const column = this.sortState.writerCostTable.column;
            const direction = this.sortState.writerCostTable.direction;
            
            costData.sort((a, b) => {
                let aVal = a[column];
                let bVal = b[column];
                
                // Handle string vs number comparison
                if (typeof aVal === 'string') {
                    aVal = aVal.toLowerCase();
                    bVal = bVal.toLowerCase();
                }
                
                if (direction === 'asc') {
                    return aVal > bVal ? 1 : (aVal < bVal ? -1 : 0);
                } else {
                    return aVal < bVal ? 1 : (aVal > bVal ? -1 : 0);
                }
            });
        }
        
        // Render sorted data
        costData.forEach(data => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${data.writer}</td>
                <td>${data.avgCostBaseline.toFixed(2)} €</td>
                <td>${data.medianCostBaseline.toFixed(2)} €</td>
                <td>${data.baselineCost.toFixed(2)} €</td>
                <td>${data.effectiveRateBaseline.toFixed(4)} €</td>
                <td>${data.avgCostSimulation.toFixed(2)} €</td>
                <td>${data.medianCostSimulation.toFixed(2)} €</td>
                <td>${data.simulationCost.toFixed(2)} €</td>
                <td>${data.effectiveRateSimulation.toFixed(4)} €</td>
                <td style="color: ${data.difference < 0 ? '#10B981' : '#EF4444'}">${data.difference > 0 ? '+' : ''}${data.difference.toFixed(1)}%</td>
                <td style="color: ${data.savings > 0 ? '#10B981' : '#EF4444'}">${data.savings > 0 ? '-' : '+'}${Math.abs(data.savings).toFixed(2)} €</td>
            `;
            tbody.appendChild(row);
        });
    }

    updateDataGrid() {
        const tbody = document.getElementById('articleTableBody');
        tbody.innerHTML = '';
        
        // Create a copy of articles for sorting
        let sortedArticles = [...this.articles];
        
        // Apply sorting if a column is selected
        if (this.sortState.articleTable.column) {
            const column = this.sortState.articleTable.column;
            const direction = this.sortState.articleTable.direction;
            
            sortedArticles.sort((a, b) => {
                let aVal, bVal;
                
                // Map column names to article properties
                switch(column) {
                    case 'url':
                        aVal = a.url.toLowerCase();
                        bVal = b.url.toLowerCase();
                        break;
                    case 'writer':
                        aVal = a.writer.toLowerCase();
                        bVal = b.writer.toLowerCase();
                        break;
                    case 'publishDate':
                        aVal = a.publishDate;
                        bVal = b.publishDate;
                        break;
                    case 'wordCount':
                        aVal = a.wordCount;
                        bVal = b.wordCount;
                        break;
                    case 'baselineCost':
                        aVal = a.baselineCost;
                        bVal = b.baselineCost;
                        break;
                    case 'simulationCost':
                        aVal = a.simulationCost;
                        bVal = b.simulationCost;
                        break;
                    case 'difference':
                        aVal = a.simulationCost - a.baselineCost;
                        bVal = b.simulationCost - b.baselineCost;
                        break;
                    default:
                        aVal = a[column];
                        bVal = b[column];
                }
                
                if (direction === 'asc') {
                    return aVal > bVal ? 1 : (aVal < bVal ? -1 : 0);
                } else {
                    return aVal < bVal ? 1 : (aVal > bVal ? -1 : 0);
                }
            });
        }
        
        // Render sorted data
        sortedArticles.forEach(article => {
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
        
        // Calculate global monthly data
        const globalMonthlyData = {};
        // Calculate per-writer monthly data
        const writerMonthlyData = {};
        
        this.articles.forEach(article => {
            const monthKey = `${article.publishDate.getFullYear()}-${String(article.publishDate.getMonth() + 1).padStart(2, '0')}`;
            
            // Global data
            if (!globalMonthlyData[monthKey]) {
                globalMonthlyData[monthKey] = { count: 0, totalWords: 0 };
            }
            globalMonthlyData[monthKey].count++;
            globalMonthlyData[monthKey].totalWords += article.wordCount;
            
            // Per-writer data
            if (!writerMonthlyData[article.writer]) {
                writerMonthlyData[article.writer] = {};
            }
            if (!writerMonthlyData[article.writer][monthKey]) {
                writerMonthlyData[article.writer][monthKey] = { count: 0, totalWords: 0 };
            }
            writerMonthlyData[article.writer][monthKey].count++;
            writerMonthlyData[article.writer][monthKey].totalWords += article.wordCount;
        });
        
        const sortedMonths = Object.keys(globalMonthlyData).sort();
        const labels = sortedMonths.map(month => {
            const [year, monthNum] = month.split('-');
            return new Date(year, monthNum - 1).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
        });
        
        // Prepare global dataset
        const globalAvgWordCounts = sortedMonths.map(month => 
            Math.round(globalMonthlyData[month].totalWords / globalMonthlyData[month].count)
        );
        
        // Define colors for writers
        const writerColors = [
            '#EF4444', // Red
            '#10B981', // Green
            '#F59E0B', // Amber
            '#8B5CF6', // Violet
            '#EC4899', // Pink
            '#06B6D4', // Cyan
            '#84CC16', // Lime
            '#F97316'  // Orange
        ];
        
        // Create datasets array
        const datasets = [{
            label: 'Moyenne globale',
            data: globalAvgWordCounts,
            borderColor: '#0EA5E9',
            backgroundColor: 'rgba(14, 165, 233, 0.1)',
            borderWidth: 3,
            tension: 0.3,
            pointRadius: 4,
            pointHoverRadius: 6
        }];
        
        // Add per-writer datasets
        const sortedWriters = Array.from(this.writers).sort();
        sortedWriters.forEach((writer, index) => {
            const writerData = sortedMonths.map(month => {
                if (writerMonthlyData[writer] && writerMonthlyData[writer][month]) {
                    return Math.round(writerMonthlyData[writer][month].totalWords / writerMonthlyData[writer][month].count);
                }
                return null; // No data for this month
            });
            
            const color = writerColors[index % writerColors.length];
            datasets.push({
                label: writer,
                data: writerData,
                borderColor: color,
                backgroundColor: color + '20', // Add transparency
                borderWidth: 2,
                tension: 0.3,
                spanGaps: true, // Connect lines across missing data points
                pointRadius: 3,
                pointHoverRadius: 5,
                borderDash: index % 2 === 0 ? [] : [5, 5] // Alternate solid and dashed lines
            });
        });
        
        if (window.wordCountChart && typeof window.wordCountChart.destroy === 'function') {
            window.wordCountChart.destroy();
        }
        
        window.wordCountChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 10
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += context.parsed.y.toLocaleString('fr-FR') + ' mots';
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        title: {
                            display: true,
                            text: 'Nombre de mots moyen'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Mois'
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
        
        if (window.costComparisonChart && typeof window.costComparisonChart.destroy === 'function') {
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
    
    initializeTableSorting() {
        // Add click listeners to writer stats table headers
        document.querySelectorAll('#writerStatsTable .sortable-header').forEach(header => {
            header.addEventListener('click', () => {
                const column = header.dataset.column;
                this.sortWriterStatsTable(column);
            });
        });
        
        // Add click listeners to writer cost table headers
        document.querySelectorAll('#writerCostTable .sortable-header').forEach(header => {
            header.addEventListener('click', () => {
                const column = header.dataset.column;
                this.sortWriterCostTable(column);
            });
        });
        
        // Add click listeners to article table headers
        document.querySelectorAll('#articleTable .sortable-header').forEach(header => {
            header.addEventListener('click', () => {
                const column = header.dataset.column;
                this.sortArticleTable(column);
            });
        });
    }
    
    sortWriterStatsTable(column) {
        // Toggle sort direction if same column, otherwise reset to ascending
        if (this.sortState.writerStatsTable.column === column) {
            this.sortState.writerStatsTable.direction = this.sortState.writerStatsTable.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortState.writerStatsTable.column = column;
            this.sortState.writerStatsTable.direction = 'asc';
        }
        
        // Update header classes
        document.querySelectorAll('#writerStatsTable .sortable-header').forEach(header => {
            header.classList.remove('sort-asc', 'sort-desc');
            if (header.dataset.column === column) {
                header.classList.add(`sort-${this.sortState.writerStatsTable.direction}`);
            }
        });
        
        // Re-render the table with sorted data
        this.updateWriterStatsTable();
    }
    
    sortWriterCostTable(column) {
        // Toggle sort direction if same column, otherwise reset to ascending
        if (this.sortState.writerCostTable.column === column) {
            this.sortState.writerCostTable.direction = this.sortState.writerCostTable.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortState.writerCostTable.column = column;
            this.sortState.writerCostTable.direction = 'asc';
        }
        
        // Update header classes
        document.querySelectorAll('#writerCostTable .sortable-header').forEach(header => {
            header.classList.remove('sort-asc', 'sort-desc');
            if (header.dataset.column === column) {
                header.classList.add(`sort-${this.sortState.writerCostTable.direction}`);
            }
        });
        
        // Re-render the table with sorted data
        this.updateWriterCostTable();
    }
    
    sortArticleTable(column) {
        // Toggle sort direction if same column, otherwise reset to ascending
        if (this.sortState.articleTable.column === column) {
            this.sortState.articleTable.direction = this.sortState.articleTable.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortState.articleTable.column = column;
            this.sortState.articleTable.direction = 'asc';
        }
        
        // Update header classes
        document.querySelectorAll('#articleTable .sortable-header').forEach(header => {
            header.classList.remove('sort-asc', 'sort-desc');
            if (header.dataset.column === column) {
                header.classList.add(`sort-${this.sortState.articleTable.direction}`);
            }
        });
        
        // Re-render the table with sorted data
        this.updateDataGrid();
    }
    
    openConfigModal() {
        const modal = document.getElementById('configModal');
        if (modal) {
            modal.style.display = 'flex';
            
            // Copy current configuration to temp config
            this.tempConfig = {
                baseline: { ...this.configuration.globalDefaults.baseline },
                simulation: { ...this.configuration.globalDefaults.simulation },
                writerOverrides: JSON.parse(JSON.stringify(this.configuration.writerOverrides))
            };
            
            // Restore the configuration in the modal
            this.restoreModalConfiguration();
            this.populateModalWriterConfigs();
            this.updatePreview();
        }
    }
    
    restoreModalConfiguration() {
        // Restore baseline model and parameters
        const baselineModel = this.configuration.globalDefaults.baseline.model;
        const baselineRadio = document.getElementById(`baseline-${baselineModel}`);
        if (baselineRadio) {
            baselineRadio.checked = true;
            this.updateModalModelParams('baseline', baselineModel);
            
            // Restore baseline parameters
            Object.entries(this.configuration.globalDefaults.baseline.params).forEach(([key, value]) => {
                const input = document.querySelector(`#baseline-params .modal-param-input[data-param="${key}"]`);
                if (input) input.value = value;
            });
            
            // Restore baseline bonus
            const baselineBonus = document.querySelector(`#baseline-params .modal-param-input[data-param="bonus"]`);
            if (baselineBonus) baselineBonus.value = this.configuration.globalDefaults.baseline.bonusPercent || 0;
        }
        
        // Restore simulation model and parameters
        const simulationModel = this.configuration.globalDefaults.simulation.model;
        const simulationRadio = document.getElementById(`simulation-${simulationModel}`);
        if (simulationRadio) {
            simulationRadio.checked = true;
            this.updateModalModelParams('simulation', simulationModel);
            
            // Restore simulation parameters
            Object.entries(this.configuration.globalDefaults.simulation.params).forEach(([key, value]) => {
                const input = document.querySelector(`#simulation-params .modal-param-input[data-param="${key}"]`);
                if (input) input.value = value;
            });
            
            // Restore simulation bonus
            const simulationBonus = document.querySelector(`#simulation-params .modal-param-input[data-param="bonus"]`);
            if (simulationBonus) simulationBonus.value = this.configuration.globalDefaults.simulation.bonusPercent || 0;
        }
    }
    
    closeConfigModal() {
        const modal = document.getElementById('configModal');
        if (modal) {
            modal.style.display = 'none';
            // Restore temp config to original values (in case of cancel)
            this.tempConfig = {
                baseline: { ...this.configuration.globalDefaults.baseline },
                simulation: { ...this.configuration.globalDefaults.simulation },
                writerOverrides: JSON.parse(JSON.stringify(this.configuration.writerOverrides))
            };
        }
    }
    
    switchConfigTab(tabName) {
        document.querySelectorAll('.config-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelectorAll('.config-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        
        document.querySelector(`.config-tab[data-config="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}-config`).classList.add('active');
    }
    
    updateModalModelParams(scenario, model) {
        const container = document.getElementById(`${scenario}-params`);
        if (!container) return;
        
        container.innerHTML = '';
        container.innerHTML = '<h5>Paramètres</h5>';
        
        const paramGroup = document.createElement('div');
        paramGroup.className = 'parameter-group';
        
        const params = this.getModelParamsForModal(model);
        params.forEach(param => {
            const field = document.createElement('div');
            field.className = 'parameter-field';
            field.innerHTML = `
                <label>${param.label}</label>
                <input type="number" 
                       data-scenario="${scenario}"
                       data-param="${param.key}" 
                       value="${param.defaultValue}" 
                       step="${param.step || 0.01}"
                       min="0"
                       class="modal-param-input">
                ${param.help ? `<div class="help">${param.help}</div>` : ''}
            `;
            paramGroup.appendChild(field);
        });
        
        // Add quality bonus field
        const bonusField = document.createElement('div');
        bonusField.className = 'parameter-field';
        bonusField.innerHTML = `
            <label>Bonus Qualité (%)</label>
            <input type="number" 
                   data-scenario="${scenario}"
                   data-param="bonus" 
                   value="0" 
                   step="0.5"
                   min="0"
                   max="20"
                   class="modal-param-input">
            <div class="help">Augmentation pour récompenser la qualité</div>
        `;
        paramGroup.appendChild(bonusField);
        
        container.appendChild(paramGroup);
        
        // Update temp config
        this.tempConfig[scenario].model = model;
        this.tempConfig[scenario].params = this.getDefaultParamsForModel(model);
        
        // Add change listeners
        container.querySelectorAll('.modal-param-input').forEach(input => {
            input.addEventListener('input', () => {
                this.updateTempConfigFromModal();
                this.updatePreview();
            });
        });
    }
    
    getModelParamsForModal(model) {
        const params = {
            'PW': [
                { label: 'Tarif par mot (€)', key: 'rate', defaultValue: 0.13, step: 0.001, help: 'Prix pour chaque mot' }
            ],
            'FP': [
                { label: 'Prix fixe (€)', key: 'fixedAmount', defaultValue: 100, step: 1, help: 'Montant fixe par article' }
            ],
            'HY': [
                { label: 'Frais de base (€)', key: 'baseFee', defaultValue: 50, step: 1, help: 'Coût initial de recherche' },
                { label: 'Tarif réduit (€/mot)', key: 'reducedRate', defaultValue: 0.08, step: 0.001, help: 'Prix par mot après les frais de base' }
            ],
            'DMR': [
                { label: 'Tarif standard (€/mot)', key: 'standardRate', defaultValue: 0.13, step: 0.001, help: 'Prix normal par mot' },
                { label: 'Seuil (mots)', key: 'threshold', defaultValue: 1000, step: 100, help: 'Nombre de mots avant réduction' },
                { label: 'Tarif réduit (€/mot)', key: 'lowerRate', defaultValue: 0.08, step: 0.001, help: 'Prix après le seuil' }
            ],
            'CO': [
                { label: 'Prix fixe (€)', key: 'fixedAmount', defaultValue: 500, step: 1, help: 'Montant pour articles normaux' },
                { label: 'Plafond (mots)', key: 'cap', defaultValue: 5000, step: 100, help: 'Limite avant tarif supplémentaire' },
                { label: 'Tarif dépassement (€/mot)', key: 'overageRate', defaultValue: 0.13, step: 0.001, help: 'Prix par mot au-delà du plafond' }
            ]
        };
        return params[model] || [];
    }
    
    getDefaultParamsForModel(model) {
        const defaults = {
            'PW': { rate: 0.13 },
            'FP': { fixedAmount: 100 },
            'HY': { baseFee: 50, reducedRate: 0.08 },
            'DMR': { standardRate: 0.13, threshold: 1000, lowerRate: 0.08 },
            'CO': { fixedAmount: 500, cap: 5000, overageRate: 0.13 }
        };
        return defaults[model] || {}; 
    }
    
    populateModalWriterConfigs() {
        const baselineContainer = document.getElementById('baseline-writer-configs');
        const simulationContainer = document.getElementById('simulation-writer-configs');
        
        if (!baselineContainer || !simulationContainer) return;
        
        baselineContainer.innerHTML = '';
        simulationContainer.innerHTML = '';
        
        const writerStats = this.calculateWriterStatistics();
        
        Array.from(this.writers).sort().forEach(writer => {
            const stats = writerStats[writer];
            const hasBaselineOverride = this.configuration.writerOverrides[writer]?.baseline;
            const hasSimulationOverride = this.configuration.writerOverrides[writer]?.simulation;
            
            // Baseline config
            const baselineRow = document.createElement('div');
            baselineRow.className = 'writer-config-item';
            baselineRow.innerHTML = `
                <div class="writer-config-row">
                    <div>
                        <div class="writer-name-label">${writer}</div>
                        <div class="writer-stats-label">CV: ${stats.cv.toFixed(2)} | Moy: ${stats.mean} mots</div>
                    </div>
                    <div class="writer-config-control">
                        <input type="checkbox" class="writer-override-checkbox" 
                               data-scenario="baseline" data-writer="${writer}"
                               ${hasBaselineOverride ? 'checked' : ''}>
                        <select class="writer-model-select" data-scenario="baseline" data-writer="${writer}" 
                                ${hasBaselineOverride ? '' : 'disabled'}>
                            <option value="PW" ${hasBaselineOverride && hasBaselineOverride.model === 'PW' ? 'selected' : ''}>Tarif au volume</option>
                            <option value="FP" ${hasBaselineOverride && hasBaselineOverride.model === 'FP' ? 'selected' : ''}>Prix fixe</option>
                            <option value="HY" ${hasBaselineOverride && hasBaselineOverride.model === 'HY' ? 'selected' : ''}>Hybride</option>
                            <option value="DMR" ${hasBaselineOverride && hasBaselineOverride.model === 'DMR' ? 'selected' : ''}>Dégressif</option>
                            <option value="CO" ${hasBaselineOverride && hasBaselineOverride.model === 'CO' ? 'selected' : ''}>Plafonné</option>
                        </select>
                    </div>
                </div>
                <div class="writer-params-container" id="baseline-params-${writer}" style="display: none;"></div>
            `;
            baselineContainer.appendChild(baselineRow);
            
            // Simulation config
            const simulationRow = document.createElement('div');
            simulationRow.className = 'writer-config-item';
            simulationRow.innerHTML = `
                <div class="writer-config-row">
                    <div>
                        <div class="writer-name-label">${writer}</div>
                        <div class="writer-stats-label">CV: ${stats.cv.toFixed(2)} | P75: ${stats.p75} mots</div>
                    </div>
                    <div class="writer-config-control">
                        <input type="checkbox" class="writer-override-checkbox" 
                               data-scenario="simulation" data-writer="${writer}"
                               ${hasSimulationOverride ? 'checked' : ''}>
                        <select class="writer-model-select" data-scenario="simulation" data-writer="${writer}" 
                                ${hasSimulationOverride ? '' : 'disabled'}>
                            <option value="PW" ${hasSimulationOverride ? (hasSimulationOverride.model === 'PW' ? 'selected' : '') : ''}>Tarif au volume</option>
                            <option value="FP" ${hasSimulationOverride ? (hasSimulationOverride.model === 'FP' ? 'selected' : '') : ''}>Prix fixe</option>
                            <option value="HY" ${hasSimulationOverride ? (hasSimulationOverride.model === 'HY' ? 'selected' : '') : ''}>Hybride</option>
                            <option value="DMR" ${hasSimulationOverride ? (hasSimulationOverride.model === 'DMR' ? 'selected' : '') : ''}>Dégressif</option>
                            <option value="CO" ${hasSimulationOverride ? (hasSimulationOverride.model === 'CO' ? 'selected' : '') : (stats.cv < 0.3 ? 'selected' : '')}>Plafonné</option>
                        </select>
                    </div>
                </div>
                <div class="writer-params-container" id="simulation-params-${writer}" style="display: none;"></div>
            `;
            simulationContainer.appendChild(simulationRow);
        });
        
        // Restore writer override parameters
        Object.entries(this.configuration.writerOverrides).forEach(([writer, overrides]) => {
            if (overrides.baseline) {
                const container = document.getElementById(`baseline-params-${writer}`);
                if (container) {
                    container.style.display = 'block';
                    this.updateWriterModelParams(writer, 'baseline', overrides.baseline.model);
                    
                    // Restore parameter values after a short delay to ensure inputs exist
                    setTimeout(() => {
                        Object.entries(overrides.baseline.params).forEach(([key, value]) => {
                            const input = document.querySelector(`.writer-param-input[data-writer="${writer}"][data-scenario="baseline"][data-param="${key}"]`);
                            if (input) input.value = value;
                        });
                    }, 50);
                }
            }
            
            if (overrides.simulation) {
                const container = document.getElementById(`simulation-params-${writer}`);
                if (container) {
                    container.style.display = 'block';
                    this.updateWriterModelParams(writer, 'simulation', overrides.simulation.model);
                    
                    // Restore parameter values after a short delay to ensure inputs exist
                    setTimeout(() => {
                        Object.entries(overrides.simulation.params).forEach(([key, value]) => {
                            const input = document.querySelector(`.writer-param-input[data-writer="${writer}"][data-scenario="simulation"][data-param="${key}"]`);
                            if (input) input.value = value;
                        });
                    }, 50);
                }
            }
        });
        
        // Add change listeners
        document.querySelectorAll('.writer-override-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const writer = e.target.dataset.writer;
                const scenario = e.target.dataset.scenario;
                const select = e.target.parentElement.querySelector('.writer-model-select');
                const paramsContainer = document.getElementById(`${scenario}-params-${writer}`);
                
                select.disabled = !e.target.checked;
                
                if (e.target.checked) {
                    paramsContainer.style.display = 'block';
                    this.updateWriterModelParams(writer, scenario, select.value);
                } else {
                    paramsContainer.style.display = 'none';
                }
                
                this.updateTempConfigFromModal();
                this.updatePreview();
            });
        });
        
        document.querySelectorAll('.writer-model-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const writer = e.target.dataset.writer;
                const scenario = e.target.dataset.scenario;
                this.updateWriterModelParams(writer, scenario, e.target.value);
                this.updateTempConfigFromModal();
                this.updatePreview();
            });
        });
    }
    
    updateTempConfigFromModal() {
        // Update baseline
        const baselineModel = document.querySelector('input[name="baseline-model"]:checked')?.value || 'PW';
        this.tempConfig.baseline.model = baselineModel;
        this.tempConfig.baseline.params = {};
        
        document.querySelectorAll('#baseline-params .modal-param-input').forEach(input => {
            const param = input.dataset.param;
            if (param === 'bonus') {
                this.tempConfig.baseline.bonusPercent = parseFloat(input.value) || 0;
            } else {
                this.tempConfig.baseline.params[param] = parseFloat(input.value) || 0;
            }
        });
        
        // Update simulation
        const simulationModel = document.querySelector('input[name="simulation-model"]:checked')?.value || 'PW';
        this.tempConfig.simulation.model = simulationModel;
        this.tempConfig.simulation.params = {};
        
        document.querySelectorAll('#simulation-params .modal-param-input').forEach(input => {
            const param = input.dataset.param;
            if (param === 'bonus') {
                this.tempConfig.simulation.bonusPercent = parseFloat(input.value) || 0;
            } else {
                this.tempConfig.simulation.params[param] = parseFloat(input.value) || 0;
            }
        });
        
        // Update writer overrides
        this.tempConfig.writerOverrides = {};
        
        document.querySelectorAll('.writer-override-checkbox:checked').forEach(checkbox => {
            const writer = checkbox.dataset.writer;
            const scenario = checkbox.dataset.scenario;
            const select = checkbox.parentElement.querySelector('.writer-model-select');
            const model = select.value;
            
            if (!this.tempConfig.writerOverrides[writer]) {
                this.tempConfig.writerOverrides[writer] = {};
            }
            
            // Get parameters from inputs
            const config = {
                model: model,
                params: {},
                bonusPercent: 0
            };
            
            // Read writer-specific parameters
            document.querySelectorAll(`.writer-param-input[data-writer="${writer}"][data-scenario="${scenario}"]`).forEach(input => {
                const param = input.dataset.param;
                if (param === 'bonus') {
                    config.bonusPercent = parseFloat(input.value) || 0;
                } else {
                    config.params[param] = parseFloat(input.value) || 0;
                }
            });
            
            // If no params found (shouldn't happen), use smart defaults
            if (Object.keys(config.params).length === 0) {
                const writerStats = this.calculateWriterStatistics();
                const stats = writerStats[writer];
                config = this.getSmartConfigForWriter(model, stats);
            }
            
            this.tempConfig.writerOverrides[writer][scenario] = config;
        });
    }
    
    getSmartConfigForWriter(model, stats) {
        const config = {
            model: model,
            params: {},
            bonusPercent: 0
        };
        
        switch (model) {
            case 'PW':
                config.params.rate = 0.13;
                break;
            case 'CO':
                config.params.cap = stats.p75;
                config.params.fixedAmount = Math.round(stats.p75 * 0.11);
                config.params.overageRate = 0.13;
                break;
            case 'FP':
                config.params.fixedAmount = Math.round(stats.mean * 0.12);
                break;
            case 'HY':
                config.params.baseFee = Math.round(stats.mean * 0.05);
                config.params.reducedRate = 0.08;
                break;
            case 'DMR':
                config.params.standardRate = 0.13;
                config.params.threshold = stats.median;
                config.params.lowerRate = 0.08;
                break;
        }
        
        return config;
    }
    
    updatePreview() {
        if (!this.articles || this.articles.length === 0) return;
        
        // Calculate costs with temp config
        let totalBaselineCost = 0;
        let totalSimulationCost = 0;
        const writerImpacts = {};
        
        this.articles.forEach(article => {
            const baselineConfig = this.getTempWriterConfig(article.writer, 'baseline');
            const simulationConfig = this.getTempWriterConfig(article.writer, 'simulation');
            
            const baselineCost = this.calculateCost(article.wordCount, baselineConfig);
            const simulationCost = this.calculateCost(article.wordCount, simulationConfig);
            
            totalBaselineCost += baselineCost;
            totalSimulationCost += simulationCost;
            
            if (!writerImpacts[article.writer]) {
                writerImpacts[article.writer] = { baseline: 0, simulation: 0 };
            }
            writerImpacts[article.writer].baseline += baselineCost;
            writerImpacts[article.writer].simulation += simulationCost;
        });
        
        // Update preview display
        document.getElementById('preview-baseline-cost').textContent = `${totalBaselineCost.toFixed(2)} €`;
        document.getElementById('preview-simulation-cost').textContent = `${totalSimulationCost.toFixed(2)} €`;
        
        const difference = totalSimulationCost - totalBaselineCost;
        const diffPercent = totalBaselineCost > 0 ? (difference / totalBaselineCost) * 100 : 0;
        const diffElement = document.getElementById('preview-difference');
        diffElement.textContent = `${difference > 0 ? '+' : ''}${difference.toFixed(2)} € (${diffPercent > 0 ? '+' : ''}${diffPercent.toFixed(1)}%)`;
        diffElement.parentElement.classList.toggle('positive', difference > 0);
        diffElement.parentElement.classList.toggle('negative', difference < 0);
        
        // Update writer impacts
        const impactContainer = document.getElementById('preview-writer-impact');
        impactContainer.innerHTML = '';
        
        Object.entries(writerImpacts).forEach(([writer, costs]) => {
            const change = costs.simulation - costs.baseline;
            const changePercent = costs.baseline > 0 ? (change / costs.baseline) * 100 : 0;
            
            const row = document.createElement('div');
            row.className = 'writer-impact-row';
            row.innerHTML = `
                <span class="name">${writer}</span>
                <span class="change ${change > 0 ? 'positive' : 'negative'}">
                    ${change > 0 ? '+' : ''}${change.toFixed(0)} € (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%)
                </span>
            `;
            impactContainer.appendChild(row);
        });
    }
    
    getTempWriterConfig(writer, scenario) {
        const override = this.tempConfig.writerOverrides[writer];
        if (override && override[scenario]) {
            return override[scenario];
        }
        return this.tempConfig[scenario];
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new PricingSimulator();
});