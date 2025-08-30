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

        // Initialize wizard navigation
        this.initializeWizard();

        // Tab navigation
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
    }

    initializeWizard() {
        // Strategy selection
        document.querySelectorAll('.strategy-card').forEach(card => {
            card.addEventListener('click', (e) => {
                document.querySelectorAll('.strategy-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.selectedStrategy = card.dataset.strategy;
            });
        });

        // Model selection
        document.querySelectorAll('.model-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.model-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                const radio = card.querySelector('.model-radio');
                if (radio) radio.checked = true;
                this.selectedModel = card.dataset.model;
                this.showModelParams(this.selectedModel);
            });
        });

        // Navigation buttons
        const nextToModels = document.getElementById('nextToModels');
        if (nextToModels) {
            nextToModels.addEventListener('click', () => {
                this.goToStep('models');
                this.applyStrategyPreset();
            });
        }

        const backToStrategy = document.getElementById('backToStrategy');
        if (backToStrategy) {
            backToStrategy.addEventListener('click', () => this.goToStep('strategy'));
        }

        const nextToWriters = document.getElementById('nextToWriters');
        if (nextToWriters) {
            nextToWriters.addEventListener('click', () => {
                this.goToStep('writers');
                this.populateWriterRecommendations();
            });
        }

        const backToModels = document.getElementById('backToModels');
        if (backToModels) {
            backToModels.addEventListener('click', () => this.goToStep('models'));
        }

        const applyConfig = document.getElementById('applyConfig');
        if (applyConfig) {
            applyConfig.addEventListener('click', () => {
                this.applyWizardConfiguration();
            });
        }

        // Wizard tabs
        document.querySelectorAll('.wizard-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const step = tab.dataset.step;
                if (tab.classList.contains('completed') || tab.classList.contains('active')) {
                    this.goToStep(step);
                }
            });
        });
    }

    goToStep(step) {
        // Update tabs
        document.querySelectorAll('.wizard-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.step === step) {
                tab.classList.add('active');
            }
        });

        // Update content
        document.querySelectorAll('.wizard-step').forEach(content => {
            content.style.display = 'none';
        });
        const stepContent = document.getElementById(`${step}-step`);
        if (stepContent) {
            stepContent.style.display = 'block';
        }

        // Mark previous steps as completed
        const steps = ['strategy', 'models', 'writers'];
        const currentIndex = steps.indexOf(step);
        steps.forEach((s, index) => {
            const tab = document.querySelector(`.wizard-tab[data-step="${s}"]`);
            if (tab && index < currentIndex) {
                tab.classList.add('completed');
            }
        });
    }

    applyStrategyPreset() {
        if (!this.selectedStrategy) this.selectedStrategy = 'optimize';
        
        if (this.selectedStrategy === 'optimize') {
            // Pre-select Cap+Overage model for optimization
            const coCard = document.querySelector('.model-card[data-model="CO"]');
            if (coCard) {
                coCard.click();
            }
        } else if (this.selectedStrategy === 'quality') {
            // Pre-select Per-Word with bonus
            const pwCard = document.querySelector('.model-card[data-model="PW"]');
            if (pwCard) {
                pwCard.click();
            }
        }
    }

    showModelParams(model) {
        const container = document.getElementById('modelParamsContainer');
        const section = document.getElementById('globalModelParams');
        
        if (!container || !section) return;
        
        section.style.display = 'block';
        container.innerHTML = '';
        
        const params = this.getModelParamsWithLabels(model);
        params.forEach(param => {
            const group = document.createElement('div');
            group.className = 'form-group';
            group.innerHTML = `
                <label>${param.label}:</label>
                <input type="number" 
                       data-param="${param.key}" 
                       value="${param.defaultValue}" 
                       step="${param.step || 0.01}"
                       min="0"
                       class="global-param-input">
                ${param.hint ? `<small class="param-hint">${param.hint}</small>` : ''}
            `;
            container.appendChild(group);
        });

        // Add quality bonus for quality strategy
        if (this.selectedStrategy === 'quality') {
            const bonusGroup = document.createElement('div');
            bonusGroup.className = 'form-group';
            bonusGroup.innerHTML = `
                <label>Bonus Qualité (%):</label>
                <input type="number" 
                       data-param="bonus" 
                       value="5" 
                       step="0.5"
                       min="0"
                       max="20"
                       class="global-param-input">
                <small class="param-hint">Augmentation pour récompenser la qualité</small>
            `;
            container.appendChild(bonusGroup);
        }
    }

    getModelParamsWithLabels(model) {
        const params = {
            'PW': [
                { label: 'Tarif par mot', key: 'rate', defaultValue: 0.13, step: 0.001, hint: 'Prix en € pour chaque mot' }
            ],
            'FP': [
                { label: 'Prix fixe par article', key: 'fixedAmount', defaultValue: 100, step: 1, hint: 'Montant fixe peu importe la longueur' }
            ],
            'HY': [
                { label: 'Frais de recherche', key: 'baseFee', defaultValue: 50, step: 1, hint: 'Coût de base pour la recherche' },
                { label: 'Tarif par mot', key: 'reducedRate', defaultValue: 0.08, step: 0.001, hint: 'Tarif réduit pour l\'écriture' }
            ],
            'DMR': [
                { label: 'Tarif normal', key: 'standardRate', defaultValue: 0.13, step: 0.001, hint: 'Prix par mot jusqu\'au seuil' },
                { label: 'Seuil (mots)', key: 'threshold', defaultValue: 1000, step: 100, hint: 'Nombre de mots avant réduction' },
                { label: 'Tarif réduit', key: 'lowerRate', defaultValue: 0.08, step: 0.001, hint: 'Prix par mot après le seuil' }
            ],
            'CO': [
                { label: 'Prix jusqu\'au plafond', key: 'fixedAmount', defaultValue: 500, step: 1, hint: 'Montant fixe pour articles normaux' },
                { label: 'Plafond (mots)', key: 'cap', defaultValue: 5000, step: 100, hint: 'Limite avant tarif supplémentaire' },
                { label: 'Tarif dépassement', key: 'overageRate', defaultValue: 0.13, step: 0.001, hint: 'Prix par mot au-delà du plafond' }
            ]
        };
        return params[model] || [];
    }

    processCSV(file) {
        Papa.parse(file, {
            header: true,
            complete: (results) => {
                try {
                    this.parseArticles(results.data);
                    this.showFeedback('success', `✓ ${this.articles.length} articles importés avec succès`);
                    document.getElementById('configSection').style.display = 'block';
                    // Don't auto-populate here - wait for wizard navigation
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

    populateWriterConfigs() {
        // Old method - kept for compatibility but now called from populateWriterRecommendations
        this.populateWriterRecommendations();
    }

    populateWriterRecommendations() {
        const container = document.getElementById('writerRecommendations');
        if (!container) return;
        
        container.innerHTML = '';
        const writerStats = this.calculateWriterStatistics();
        
        // Group writers by recommendation
        const consistentWriters = [];
        const variableWriters = [];
        const averageWriters = [];
        
        this.writers.forEach(writer => {
            const stats = writerStats[writer];
            if (stats.cv < 0.25) {
                consistentWriters.push({ writer, stats });
            } else if (stats.cv > 0.45) {
                variableWriters.push({ writer, stats });
            } else {
                averageWriters.push({ writer, stats });
            }
        });

        // Create groups
        if (consistentWriters.length > 0) {
            this.createWriterGroup(container, '🎯 Rédacteurs réguliers', consistentWriters, 'CO', 
                'Ces rédacteurs ont une production stable. Un prix plafonné est recommandé.');
        }
        
        if (variableWriters.length > 0) {
            this.createWriterGroup(container, '📈 Rédacteurs variables', variableWriters, 'PW',
                'Ces rédacteurs ont une production variable. Un tarif au volume est recommandé.');
        }
        
        if (averageWriters.length > 0) {
            this.createWriterGroup(container, '⚖️ Rédacteurs moyens', averageWriters, 'HY',
                'Ces rédacteurs ont une variabilité modérée. Un modèle hybride peut convenir.');
        }
    }

    createWriterGroup(container, title, writers, recommendedModel, description) {
        const group = document.createElement('div');
        group.className = 'writer-recommendation-group';
        
        group.innerHTML = `
            <h4>
                ${title}
                <span class="recommendation-badge">${writers.length} rédacteur${writers.length > 1 ? 's' : ''}</span>
            </h4>
            <p style="font-size: 13px; color: #6B7280; margin-bottom: 12px;">${description}</p>
        `;
        
        writers.forEach(({ writer, stats }) => {
            const item = document.createElement('div');
            item.className = 'writer-item';
            
            // Calculate suggested parameters for CO model
            let suggestedParams = '';
            if (recommendedModel === 'CO') {
                const suggestedCap = stats.p75;
                const suggestedFixed = Math.round(suggestedCap * 0.11); // Slightly lower than average rate
                suggestedParams = `(Plafond suggéré: ${suggestedCap} mots, ${suggestedFixed}€)`;
            }
            
            item.innerHTML = `
                <div class="writer-info">
                    <div class="writer-name">${writer}</div>
                    <div class="writer-stats">
                        CV: ${stats.cv.toFixed(2)} | 
                        Moyenne: ${stats.mean} mots | 
                        P75: ${stats.p75} mots
                        ${suggestedParams}
                    </div>
                </div>
                <div class="writer-model-select">
                    <select data-writer="${writer}" class="writer-model-override">
                        <option value="default">Par défaut</option>
                        <option value="CO" ${recommendedModel === 'CO' ? 'selected' : ''}>Prix plafonné</option>
                        <option value="PW" ${recommendedModel === 'PW' ? 'selected' : ''}>Tarif au volume</option>
                        <option value="HY" ${recommendedModel === 'HY' ? 'selected' : ''}>Hybride</option>
                        <option value="FP">Prix fixe</option>
                    </select>
                </div>
            `;
            
            group.appendChild(item);
        });
        
        container.appendChild(group);
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
        // Old method - redirect to new wizard application
        this.applyWizardConfiguration();
    }

    applyWizardConfiguration() {
        // Get selected model and parameters from wizard
        const selectedModel = this.selectedModel || 'PW';
        const params = this.getDefaultParamsForModel(selectedModel);
        let bonusPercent = this.selectedStrategy === 'quality' ? 5 : 0;
        
        // Get parameters from the global model params
        document.querySelectorAll('.global-param-input').forEach(input => {
            const param = input.dataset.param;
            if (param === 'bonus') {
                bonusPercent = parseFloat(input.value) || 0;
            } else if (param) {
                params[param] = parseFloat(input.value) || 0;
            }
        });
        
        // Set baseline to current PW model (historical)
        this.configuration.globalDefaults.baseline = {
            model: 'PW',
            params: { rate: 0.13 },
            bonusPercent: 0
        };
        
        // Set simulation based on wizard selection
        this.configuration.globalDefaults.simulation = {
            model: selectedModel,
            params: params,
            bonusPercent: bonusPercent
        };
        
        // Handle writer overrides from recommendations
        this.configuration.writerOverrides = {};
        const writerStats = this.calculateWriterStatistics();
        
        document.querySelectorAll('.writer-model-override').forEach(select => {
            const writer = select.dataset.writer;
            const model = select.value;
            
            if (model !== 'default') {
                const stats = writerStats[writer];
                this.configuration.writerOverrides[writer] = {
                    simulation: this.getSmartConfigForWriter(model, stats)
                };
            }
        });
        
        this.calculateAndDisplay();
        
        // Close the configuration panel and show success
        this.showFeedback('success', '✓ Configuration appliquée avec succès!');
        
        // Switch to dashboard tab
        this.switchTab('dashboard');
    }

    getSmartConfigForWriter(model, stats) {
        const config = {
            model: model,
            params: {},
            bonusPercent: this.selectedStrategy === 'quality' ? 5 : 0
        };
        
        switch (model) {
            case 'PW':
                config.params.rate = 0.13;
                break;
            case 'CO':
                // Smart defaults based on P75
                config.params.cap = stats.p75;
                config.params.fixedAmount = Math.round(stats.p75 * 0.11);
                config.params.overageRate = 0.13;
                break;
            case 'FP':
                // Fixed price based on average
                config.params.fixedAmount = Math.round(stats.mean * 0.12);
                break;
            case 'HY':
                // Hybrid with reasonable defaults
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
        
        if (window.wordCountChart && typeof window.wordCountChart.destroy === 'function') {
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
}

document.addEventListener('DOMContentLoaded', () => {
    new PricingSimulator();
});