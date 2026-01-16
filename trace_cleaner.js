/**
 * Vibe Logger - Trace Cleaner (ETL Module)
 * Transforma traces brutos do Chrome (50MB+) em resumos semânticos (<5KB)
 */

const fs = require('fs');

class TraceCleaner {
    /**
     * Processa um arquivo de trace bruto e retorna métricas estruturadas
     * @param {string} tracePath - Caminho do arquivo .json bruto
     * @returns {object} Resumo limpo para o timeline
     */
    static process(tracePath) {
        if (!fs.existsSync(tracePath)) return null;

        let rawData;
        try {
            const content = fs.readFileSync(tracePath, 'utf8');
            rawData = JSON.parse(content);
        } catch (e) {
            console.error('ETL Error: Falha ao ler arquivo de trace', e);
            return { error: 'Trace file corrupted or unreadable' };
        }

        // O formato pode variar (array direto ou objeto com chave traceEvents)
        const events = rawData.traceEvents || (Array.isArray(rawData) ? rawData : []);

        // Inicializa acumuladores
        const metrics = {
            total_blocking_time: 0, // Soma de tempo acima de 50ms em Long Tasks
            long_tasks_count: 0,
            categories: {
                scripting: 0,
                rendering: 0, // Layout + Style
                painting: 0
            },
            offenders: [] // Top funções lentas
        };

        const tasks = []; // Array temporário para ordenar ofensores

        // timestamps no trace são em microssegundos. Converter para ms.
        events.forEach(event => {
            if (!event.dur || !event.name) return; // Ignora eventos instantâneos

            const durationMs = event.dur / 1000;
            const name = event.name;

            // 1. Scripting (Execução de JS)
            if (name === 'EvaluateScript' || name === 'FunctionCall' || name === 'v8.compile') {
                metrics.categories.scripting += durationMs;

                if (durationMs > 10) {
                    let identifier = 'Anonymous';
                    if (event.args && event.args.data) {
                        identifier = event.args.data.functionName || event.args.data.url || 'Inline Script';
                    }
                    tasks.push({ type: 'JS', name: identifier, duration: durationMs });
                }
            }

            // 2. Rendering (Cálculo de Estilo e Layout)
            if (name === 'UpdateLayoutTree' || name === 'Layout' || name === 'RecalculateStyles') {
                metrics.categories.rendering += durationMs;
            }

            // 3. Painting (Pintura na tela)
            if (name === 'Paint' || name === 'CompositeLayers') {
                metrics.categories.painting += durationMs;
            }

            // 4. Long Tasks (Bloqueio de UI > 50ms)
            if (name === 'RunTask' && durationMs > 50) {
                metrics.long_tasks_count++;
                metrics.total_blocking_time += (durationMs - 50);
            }
        });

        // Arredondamento
        Object.keys(metrics.categories).forEach(key => {
            metrics.categories[key] = Math.round(metrics.categories[key] * 100) / 100;
        });
        metrics.total_blocking_time = Math.round(metrics.total_blocking_time * 100) / 100;

        // Top 5 ofensores
        metrics.offenders = tasks
            .sort((a, b) => b.duration - a.duration)
            .slice(0, 5)
            .map(t => `${t.name} (${t.duration.toFixed(1)}ms)`);

        return {
            summary_type: "performance_bottlenecks",
            metrics: metrics,
            analysis_hint: metrics.long_tasks_count > 0
                ? "High main thread blocking detected. UI may feel unresponsive."
                : "Performance looks healthy."
        };
    }
}

module.exports = TraceCleaner;
