// Batch DOM Operations Utility
// Batches DOM operations to minimize reflows and improve performance

class BatchDOMOperations {
    constructor() {
        this.readQueue = [];
        this.writeQueue = [];
        this.isScheduled = false;
    }

    /**
     * Schedule a DOM read operation
     * @param {Function} readFn - Function that reads from DOM
     * @returns {Promise} Promise that resolves with the read result
     */
    read(readFn) {
        return new Promise((resolve) => {
            this.readQueue.push(() => {
                const result = readFn();
                resolve(result);
            });
            this.schedule();
        });
    }

    /**
     * Schedule a DOM write operation
     * @param {Function} writeFn - Function that writes to DOM
     * @returns {Promise} Promise that resolves when write is complete
     */
    write(writeFn) {
        return new Promise((resolve) => {
            this.writeQueue.push(() => {
                writeFn();
                resolve();
            });
            this.schedule();
        });
    }

    /**
     * Schedule the batch execution
     */
    schedule() {
        if (this.isScheduled) return;
        
        this.isScheduled = true;
        
        // Use requestAnimationFrame for optimal timing
        requestAnimationFrame(() => {
            this.flush();
        });
    }

    /**
     * Execute all queued operations
     */
    flush() {
        // Execute all reads first (batched together)
        while (this.readQueue.length > 0) {
            const readFn = this.readQueue.shift();
            readFn();
        }

        // Then execute all writes (batched together)
        while (this.writeQueue.length > 0) {
            const writeFn = this.writeQueue.shift();
            writeFn();
        }

        this.isScheduled = false;
    }

    /**
     * Batch update multiple elements' styles
     * @param {Array<{element: HTMLElement, styles: Object}>} updates
     */
    async batchStyleUpdates(updates) {
        await this.write(() => {
            updates.forEach(({ element, styles }) => {
                Object.assign(element.style, styles);
            });
        });
    }

    /**
     * Batch update multiple elements' attributes
     * @param {Array<{element: HTMLElement, attributes: Object}>} updates
     */
    async batchAttributeUpdates(updates) {
        await this.write(() => {
            updates.forEach(({ element, attributes }) => {
                Object.entries(attributes).forEach(([key, value]) => {
                    element.setAttribute(key, value);
                });
            });
        });
    }

    /**
     * Batch insert multiple elements
     * @param {HTMLElement} container - Container element
     * @param {Array<HTMLElement>} elements - Elements to insert
     */
    async batchInsert(container, elements) {
        await this.write(() => {
            // Use DocumentFragment for better performance
            const fragment = document.createDocumentFragment();
            elements.forEach(el => fragment.appendChild(el));
            container.appendChild(fragment);
        });
    }

    /**
     * Batch remove multiple elements
     * @param {Array<HTMLElement>} elements - Elements to remove
     */
    async batchRemove(elements) {
        await this.write(() => {
            elements.forEach(el => {
                if (el && el.parentNode) {
                    el.parentNode.removeChild(el);
                }
            });
        });
    }

    /**
     * Create elements with DocumentFragment
     * @param {Array<{tag: string, attributes: Object, styles: Object, content: string}>} elementSpecs
     * @returns {DocumentFragment} Fragment containing created elements
     */
    createElementsFragment(elementSpecs) {
        const fragment = document.createDocumentFragment();
        
        elementSpecs.forEach(spec => {
            const element = document.createElement(spec.tag);
            
            if (spec.attributes) {
                Object.entries(spec.attributes).forEach(([key, value]) => {
                    element.setAttribute(key, value);
                });
            }
            
            if (spec.styles) {
                Object.assign(element.style, spec.styles);
            }
            
            if (spec.content) {
                element.textContent = spec.content;
            }
            
            if (spec.html) {
                element.innerHTML = spec.html;
            }
            
            fragment.appendChild(element);
        });
        
        return fragment;
    }

    /**
     * Measure multiple elements' dimensions at once
     * @param {Array<HTMLElement>} elements - Elements to measure
     * @returns {Promise<Array<DOMRect>>} Array of bounding rects
     */
    async batchMeasure(elements) {
        const measurements = [];
        
        await this.read(() => {
            elements.forEach(el => {
                measurements.push(el.getBoundingClientRect());
            });
        });
        
        return measurements;
    }
}

// Create global instance
const batchDOM = new BatchDOMOperations();

// Expose globally
window.BatchDOMOperations = BatchDOMOperations;
window.batchDOM = batchDOM;

// Export for module usage
export { BatchDOMOperations, batchDOM };
export default batchDOM;

