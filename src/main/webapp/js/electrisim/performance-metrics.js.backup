/**
 * Performance Metrics Tracker for Electrisim
 * Monitors and reports key performance metrics
 * Tracks improvements from optimization efforts
 */

(function() {
    'use strict';
    
    // Metrics storage
    const metrics = {
        navigation: {},
        resources: [],
        customMarks: {},
        customMeasures: {},
        vitals: {}
    };
    
    /**
     * Collect Navigation Timing metrics
     */
    function collectNavigationTiming() {
        if (!window.performance || !window.performance.timing) {
            console.warn('Navigation Timing API not supported');
            return;
        }
        
        const timing = window.performance.timing;
        const navigationStart = timing.navigationStart;
        
        metrics.navigation = {
            // DNS lookup time
            dnsLookup: timing.domainLookupEnd - timing.domainLookupStart,
            
            // TCP connection time
            tcpConnection: timing.connectEnd - timing.connectStart,
            
            // SSL/TLS time
            sslNegotiation: timing.secureConnectionStart > 0 ? 
                timing.connectEnd - timing.secureConnectionStart : 0,
            
            // Time to First Byte (TTFB)
            ttfb: timing.responseStart - navigationStart,
            
            // Response time
            responseTime: timing.responseEnd - timing.responseStart,
            
            // DOM Interactive time
            domInteractive: timing.domInteractive - navigationStart,
            
            // DOM Content Loaded
            domContentLoaded: timing.domContentLoadedEventEnd - navigationStart,
            
            // Page Load Complete
            loadComplete: timing.loadEventEnd - navigationStart,
            
            // Total page load time
            totalLoadTime: timing.loadEventEnd - timing.navigationStart
        };
        
        console.log('📊 Navigation Timing collected:', metrics.navigation);
    }
    
    /**
     * Collect Resource Timing metrics
     */
    function collectResourceTiming() {
        if (!window.performance || !window.performance.getEntriesByType) {
            console.warn('Resource Timing API not supported');
            return;
        }
        
        const resources = window.performance.getEntriesByType('resource');
        
        metrics.resources = resources.map(resource => ({
            name: resource.name,
            type: resource.initiatorType,
            duration: resource.duration,
            size: resource.transferSize || 0,
            startTime: resource.startTime,
            // Resource timing breakdown
            dns: resource.domainLookupEnd - resource.domainLookupStart,
            tcp: resource.connectEnd - resource.connectStart,
            ttfb: resource.responseStart - resource.requestStart,
            download: resource.responseEnd - resource.responseStart
        }));
        
        // Analyze resource loading
        const analysis = analyzeResources(metrics.resources);
        console.log('📊 Resource Timing collected:', {
            total: metrics.resources.length,
            analysis
        });
    }
    
    /**
     * Analyze resource loading patterns
     */
    function analyzeResources(resources) {
        const byType = {};
        let totalSize = 0;
        let totalDuration = 0;
        
        resources.forEach(resource => {
            // Group by type
            if (!byType[resource.type]) {
                byType[resource.type] = {
                    count: 0,
                    totalSize: 0,
                    totalDuration: 0,
                    resources: []
                };
            }
            
            byType[resource.type].count++;
            byType[resource.type].totalSize += resource.size;
            byType[resource.type].totalDuration += resource.duration;
            byType[resource.type].resources.push(resource);
            
            totalSize += resource.size;
            totalDuration += resource.duration;
        });
        
        // Find slowest resources
        const slowest = [...resources]
            .sort((a, b) => b.duration - a.duration)
            .slice(0, 10);
        
        // Find largest resources
        const largest = [...resources]
            .sort((a, b) => b.size - a.size)
            .slice(0, 10);
        
        return {
            byType,
            totalSize,
            totalDuration,
            slowest: slowest.map(r => ({ name: r.name, duration: r.duration })),
            largest: largest.map(r => ({ name: r.name, size: r.size }))
        };
    }
    
    /**
     * Collect Core Web Vitals
     */
    function collectWebVitals() {
        // First Contentful Paint (FCP)
        if (window.performance && window.performance.getEntriesByName) {
            const fcpEntry = window.performance.getEntriesByName('first-contentful-paint')[0];
            if (fcpEntry) {
                metrics.vitals.fcp = fcpEntry.startTime;
            }
        }
        
        // Largest Contentful Paint (LCP)
        if ('PerformanceObserver' in window) {
            try {
                const lcpObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    metrics.vitals.lcp = lastEntry.startTime;
                });
                lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
            } catch (e) {
                console.warn('LCP observer failed:', e);
            }
            
            // First Input Delay (FID) / Interaction to Next Paint (INP)
            try {
                const fidObserver = new PerformanceObserver((list) => {
                    list.getEntries().forEach((entry) => {
                        metrics.vitals.fid = entry.processingStart - entry.startTime;
                        metrics.vitals.inp = entry.duration;
                    });
                });
                fidObserver.observe({ entryTypes: ['first-input'] });
            } catch (e) {
                console.warn('FID observer failed:', e);
            }
            
            // Cumulative Layout Shift (CLS)
            try {
                let clsValue = 0;
                const clsObserver = new PerformanceObserver((list) => {
                    list.getEntries().forEach((entry) => {
                        if (!entry.hadRecentInput) {
                            clsValue += entry.value;
                            metrics.vitals.cls = clsValue;
                        }
                    });
                });
                clsObserver.observe({ entryTypes: ['layout-shift'] });
            } catch (e) {
                console.warn('CLS observer failed:', e);
            }
        }
        
        console.log('📊 Web Vitals monitoring started');
    }
    
    /**
     * Collect custom performance marks
     */
    function collectCustomMarks() {
        if (!window.performance || !window.performance.getEntriesByType) {
            return;
        }
        
        const marks = window.performance.getEntriesByType('mark');
        marks.forEach(mark => {
            metrics.customMarks[mark.name] = mark.startTime;
        });
        
        const measures = window.performance.getEntriesByType('measure');
        measures.forEach(measure => {
            metrics.customMeasures[measure.name] = measure.duration;
        });
    }
    
    /**
     * Generate performance report
     */
    function generateReport() {
        collectNavigationTiming();
        collectResourceTiming();
        collectCustomMarks();
        
        const report = {
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent,
            navigation: metrics.navigation,
            vitals: metrics.vitals,
            customMarks: metrics.customMarks,
            customMeasures: metrics.customMeasures,
            resources: {
                count: metrics.resources.length,
                analysis: analyzeResources(metrics.resources)
            },
            // Performance scores (based on Lighthouse thresholds)
            scores: calculateScores()
        };
        
        return report;
    }
    
    /**
     * Calculate performance scores
     */
    function calculateScores() {
        const scores = {};
        
        // FCP score (good < 1800ms, poor > 3000ms)
        if (metrics.vitals.fcp) {
            scores.fcp = metrics.vitals.fcp < 1800 ? 'good' : 
                        metrics.vitals.fcp < 3000 ? 'needs-improvement' : 'poor';
        }
        
        // LCP score (good < 2500ms, poor > 4000ms)
        if (metrics.vitals.lcp) {
            scores.lcp = metrics.vitals.lcp < 2500 ? 'good' : 
                        metrics.vitals.lcp < 4000 ? 'needs-improvement' : 'poor';
        }
        
        // FID score (good < 100ms, poor > 300ms)
        if (metrics.vitals.fid) {
            scores.fid = metrics.vitals.fid < 100 ? 'good' : 
                        metrics.vitals.fid < 300 ? 'needs-improvement' : 'poor';
        }
        
        // CLS score (good < 0.1, poor > 0.25)
        if (metrics.vitals.cls !== undefined) {
            scores.cls = metrics.vitals.cls < 0.1 ? 'good' : 
                        metrics.vitals.cls < 0.25 ? 'needs-improvement' : 'poor';
        }
        
        // Total load time score (good < 3s, poor > 7s)
        if (metrics.navigation.totalLoadTime) {
            scores.loadTime = metrics.navigation.totalLoadTime < 3000 ? 'good' : 
                             metrics.navigation.totalLoadTime < 7000 ? 'needs-improvement' : 'poor';
        }
        
        return scores;
    }
    
    /**
     * Log performance summary to console
     */
    function logSummary() {
        const report = generateReport();
        
        console.log('═══════════════════════════════════════════');
        console.log('📊 ELECTRISIM PERFORMANCE REPORT');
        console.log('═══════════════════════════════════════════');
        
        console.log('\n🚀 Core Web Vitals:');
        if (report.vitals.fcp) console.log(`  FCP: ${Math.round(report.vitals.fcp)}ms (${report.scores.fcp || 'measuring...'})`);
        if (report.vitals.lcp) console.log(`  LCP: ${Math.round(report.vitals.lcp)}ms (${report.scores.lcp || 'measuring...'})`);
        if (report.vitals.fid) console.log(`  FID: ${Math.round(report.vitals.fid)}ms (${report.scores.fid || 'measuring...'})`);
        if (report.vitals.cls !== undefined) console.log(`  CLS: ${report.vitals.cls.toFixed(3)} (${report.scores.cls || 'measuring...'})`);
        
        console.log('\n⏱️ Navigation Timing:');
        console.log(`  TTFB: ${report.navigation.ttfb}ms`);
        console.log(`  DOM Interactive: ${report.navigation.domInteractive}ms`);
        console.log(`  DOM Content Loaded: ${report.navigation.domContentLoaded}ms`);
        console.log(`  Load Complete: ${report.navigation.loadComplete}ms`);
        console.log(`  Total Load Time: ${report.navigation.totalLoadTime}ms (${report.scores.loadTime || 'N/A'})`);
        
        console.log('\n📦 Resource Summary:');
        console.log(`  Total Resources: ${report.resources.count}`);
        console.log(`  Total Size: ${Math.round(report.resources.analysis.totalSize / 1024)}KB`);
        
        if (report.resources.analysis.slowest.length > 0) {
            console.log('\n🐌 Slowest Resources:');
            report.resources.analysis.slowest.slice(0, 5).forEach((r, i) => {
                const name = r.name.split('/').pop() || r.name;
                console.log(`  ${i + 1}. ${name} - ${Math.round(r.duration)}ms`);
            });
        }
        
        if (report.resources.analysis.largest.length > 0) {
            console.log('\n💾 Largest Resources:');
            report.resources.analysis.largest.slice(0, 5).forEach((r, i) => {
                const name = r.name.split('/').pop() || r.name;
                console.log(`  ${i + 1}. ${name} - ${Math.round(r.size / 1024)}KB`);
            });
        }
        
        console.log('\n═══════════════════════════════════════════');
        
        return report;
    }
    
    /**
     * Send performance data to analytics (optional)
     */
    function sendToAnalytics(data) {
        // This can be customized to send to your analytics service
        // For now, just store in localStorage for debugging
        try {
            const key = `electrisim-perf-${Date.now()}`;
            localStorage.setItem(key, JSON.stringify(data));
            
            // Keep only last 10 reports
            const keys = Object.keys(localStorage)
                .filter(k => k.startsWith('electrisim-perf-'))
                .sort()
                .reverse();
            
            keys.slice(10).forEach(k => localStorage.removeItem(k));
        } catch (e) {
            console.warn('Failed to store performance data:', e);
        }
    }
    
    /**
     * Compare current performance with previous reports
     */
    function compareWithPrevious() {
        try {
            const keys = Object.keys(localStorage)
                .filter(k => k.startsWith('electrisim-perf-'))
                .sort()
                .reverse();
            
            if (keys.length < 2) {
                console.log('Not enough data for comparison');
                return;
            }
            
            const current = generateReport();
            const previous = JSON.parse(localStorage.getItem(keys[1]));
            
            console.log('\n📈 Performance Comparison:');
            
            if (current.vitals.fcp && previous.vitals.fcp) {
                const diff = current.vitals.fcp - previous.vitals.fcp;
                const pct = ((diff / previous.vitals.fcp) * 100).toFixed(1);
                console.log(`  FCP: ${diff > 0 ? '📈' : '📉'} ${Math.abs(Math.round(diff))}ms (${pct}%)`);
            }
            
            if (current.navigation.totalLoadTime && previous.navigation.totalLoadTime) {
                const diff = current.navigation.totalLoadTime - previous.navigation.totalLoadTime;
                const pct = ((diff / previous.navigation.totalLoadTime) * 100).toFixed(1);
                console.log(`  Total Load: ${diff > 0 ? '📈' : '📉'} ${Math.abs(diff)}ms (${pct}%)`);
            }
        } catch (e) {
            console.warn('Failed to compare with previous:', e);
        }
    }
    
    // Export API
    window.ElectrisimPerformance = {
        generateReport,
        logSummary,
        sendToAnalytics,
        compareWithPrevious,
        getMetrics: () => metrics,
        
        // Custom timing functions
        mark: (name) => window.performance && window.performance.mark(name),
        measure: (name, start, end) => window.performance && window.performance.measure(name, start, end)
    };
    
    // Initialize monitoring
    function initialize() {
        collectWebVitals();
        
        // Generate report after page load
        window.addEventListener('load', () => {
            setTimeout(() => {
                const report = logSummary();
                sendToAnalytics(report);
                compareWithPrevious();
            }, 2000);
        });
    }
    
    // Start monitoring
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
    console.log('📊 Performance Metrics initialized');
})();

