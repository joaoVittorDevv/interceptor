/**
 * Vibe Logger v1.1 - Frontend Injection Layer (Smart Context)
 * Pure Vanilla JS - NO CommonJS exports (injected directly into browser)
 * 
 * This file is read via fs.readFileSync and injected into the browser.
 * It must NOT use require(), module.exports, or any Node.js syntax.
 */

(function () {
    'use strict';

    console.log('--- VIBE LOGGER v1.1 UI SCRIPT LOADED ---');

    // iFrame protection - only run in top window
    if (window.self !== window.top) {
        console.log('Vibe Logger: Skipping iframe');
        return;
    }

    // Prevent double initialization
    if (window.__vibeLoggerInitialized) {
        console.log('Vibe Logger: Already initialized');
        return;
    }
    window.__vibeLoggerInitialized = true;

    // ========================================
    // HTML SANITIZATION (Clean Snapshots)
    // ========================================

    /**
     * Get sanitized HTML without scripts, styles, and noise
     * @returns {string} Clean semantic HTML
     */
    function getCleanHTML() {
        // Clone the document to avoid modifying the actual page
        var clone = document.documentElement.cloneNode(true);

        // Tags to remove completely
        var tagsToRemove = ['script', 'style', 'link', 'noscript', 'iframe', 'object', 'embed'];

        tagsToRemove.forEach(function (tag) {
            var elements = clone.querySelectorAll(tag);
            for (var i = 0; i < elements.length; i++) {
                elements[i].parentNode.removeChild(elements[i]);
            }
        });

        // Replace SVGs with placeholder (they can be huge)
        var svgs = clone.querySelectorAll('svg');
        for (var i = 0; i < svgs.length; i++) {
            var placeholder = document.createElement('span');
            placeholder.textContent = '[SVG]';
            placeholder.setAttribute('data-original', 'svg');
            svgs[i].parentNode.replaceChild(placeholder, svgs[i]);
        }

        // Remove our own UI elements
        var vibeElements = clone.querySelectorAll('#vibe-logger-panel, #vibe-toast-container, #vibe-logger-styles');
        for (var i = 0; i < vibeElements.length; i++) {
            vibeElements[i].parentNode.removeChild(vibeElements[i]);
        }

        // Remove HTML comments
        function removeComments(node) {
            var children = node.childNodes;
            for (var i = children.length - 1; i >= 0; i--) {
                var child = children[i];
                if (child.nodeType === 8) { // Comment node
                    node.removeChild(child);
                } else if (child.nodeType === 1) { // Element node
                    removeComments(child);
                }
            }
        }
        removeComments(clone);

        // Remove inline event handlers and data attributes that are noisy
        var allElements = clone.querySelectorAll('*');
        for (var i = 0; i < allElements.length; i++) {
            var el = allElements[i];
            var attrs = el.attributes;
            var toRemove = [];

            for (var j = 0; j < attrs.length; j++) {
                var attrName = attrs[j].name.toLowerCase();
                // Remove event handlers and tracking attributes
                if (attrName.startsWith('on') ||
                    attrName.startsWith('data-gtm') ||
                    attrName.startsWith('data-analytics') ||
                    attrName.startsWith('data-track')) {
                    toRemove.push(attrName);
                }
            }

            toRemove.forEach(function (attr) {
                el.removeAttribute(attr);
            });
        }

        // Return clean HTML
        return clone.outerHTML;
    }

    /**
     * Capture and save a clean snapshot
     * @param {string} trigger - What triggered the snapshot
     */
    window.captureCleanSnapshot = function (trigger) {
        if (!window.nodeSaveSnapshot) {
            console.log('Vibe Logger: nodeSaveSnapshot not available');
            return;
        }

        try {
            var cleanHtml = getCleanHTML();
            window.nodeSaveSnapshot(cleanHtml, trigger);
        } catch (err) {
            console.log('Vibe Logger: Snapshot capture failed - ' + err.message);
        }
    };

    // ========================================
    // TOAST NOTIFICATION SYSTEM
    // ========================================
    var toastContainer = document.createElement('div');
    toastContainer.id = 'vibe-toast-container';
    toastContainer.style.cssText =
        'position: fixed; bottom: 20px; left: 20px; z-index: 2147483646;' +
        'display: flex; flex-direction: column-reverse; gap: 8px;' +
        'pointer-events: none; max-height: 50vh; overflow: hidden;';

    window.showNetworkToast = function (method, url, status) {
        if (!document.body) return;
        var toast = document.createElement('div');
        var statusColor = status >= 400 ? '#ff6b6b' : status >= 300 ? '#ffd93d' : '#6bcb77';
        var shortUrl = url.length > 60 ? url.substring(0, 57) + '...' : url;

        toast.style.cssText =
            'background: rgba(0, 0, 0, 0.85); color: white; padding: 8px 12px;' +
            'border-radius: 6px; font-family: monospace; font-size: 11px;' +
            'backdrop-filter: blur(5px); border-left: 3px solid ' + statusColor + ';' +
            'opacity: 1; transition: opacity 0.5s ease-out;' +
            'max-width: 400px; word-break: break-all;';
        toast.innerHTML = '<span style="color:' + statusColor + ';font-weight:bold">[' + method + ']</span> ' +
            shortUrl + ' <span style="color:' + statusColor + '">' + status + '</span>';

        toastContainer.appendChild(toast);

        // Keep max 5 toasts
        while (toastContainer.children.length > 5) {
            toastContainer.removeChild(toastContainer.firstChild);
        }

        // Fade out and remove after 3 seconds
        setTimeout(function () {
            toast.style.opacity = '0';
            setTimeout(function () { toast.remove(); }, 500);
        }, 3000);
    };

    // ========================================
    // CLICK TRACKER WITH RIPPLE EFFECT
    // ========================================
    function getSelector(el) {
        if (!el || el === document.body) return 'body';
        if (el.id) return '#' + el.id;
        if (el.className && typeof el.className === 'string') {
            var classes = el.className.trim().split(/\s+/).filter(function (c) { return c; }).slice(0, 2).join('.');
            if (classes) return el.tagName.toLowerCase() + '.' + classes;
        }
        return el.tagName.toLowerCase();
    }

    function createRipple(x, y) {
        if (!document.body) return;
        var ripple = document.createElement('div');
        ripple.style.cssText =
            'position: fixed; left: ' + x + 'px; top: ' + y + 'px;' +
            'width: 20px; height: 20px; margin-left: -10px; margin-top: -10px;' +
            'border: 3px solid #ff4d4d; border-radius: 50%;' +
            'pointer-events: none; z-index: 2147483647;' +
            'animation: vibeRipple 0.6s ease-out forwards;';
        document.body.appendChild(ripple);
        setTimeout(function () { ripple.remove(); }, 600);
    }

    // Inject ripple animation CSS
    function injectStyles() {
        if (document.getElementById('vibe-logger-styles')) return;
        var style = document.createElement('style');
        style.id = 'vibe-logger-styles';
        style.textContent =
            '@keyframes vibeRipple {' +
            '  0% { transform: scale(1); opacity: 1; }' +
            '  100% { transform: scale(4); opacity: 0; }' +
            '}';
        (document.head || document.documentElement).appendChild(style);
    }

    document.addEventListener('click', function (e) {
        // Create visual ripple
        createRipple(e.clientX, e.clientY);

        // Log click if recording
        if (window.nodeLogClick) {
            try {
                window.nodeLogClick({
                    x: e.clientX,
                    y: e.clientY,
                    selector: getSelector(e.target),
                    tagName: e.target.tagName
                });
            } catch (err) {
                // Silently fail if node function not available
            }
        }
    }, true);

    // ========================================
    // RECORDING UI PANEL
    // ========================================
    function initUI() {
        console.log('Vibe Logger: Initializing UI...');

        // Ensure we have somewhere to append
        if (!document.body) {
            console.log('Vibe Logger: No body, waiting...');
            setTimeout(initUI, 100);
            return;
        }

        // Check if UI already exists
        if (document.getElementById('vibe-logger-panel')) {
            console.log('Vibe Logger: Panel already exists');
            return;
        }

        injectStyles();

        // Append toast container
        document.body.appendChild(toastContainer);

        // Check recording state from Node (The Handshake)
        var isRecording = false;

        function setupUI(recordingState) {
            isRecording = recordingState || false;
            console.log('Vibe Logger: Recording state = ' + isRecording);

            // Create UI container
            var div = document.createElement('div');
            div.id = 'vibe-logger-panel';
            div.style.cssText =
                'position: fixed; bottom: 20px; right: 20px; z-index: 2147483647;' +
                'background: rgba(0,0,0,0.85); padding: 15px; border-radius: 12px;' +
                'display: flex; flex-direction: column; gap: 10px; font-family: monospace;' +
                'border: ' + (isRecording ? '2px solid red' : '1px solid #444') + ';' +
                'box-shadow: 0 10px 30px rgba(0,0,0,0.5); backdrop-filter: blur(5px);' +
                'min-width: 200px; min-height: 80px; cursor: move;';

            // Version label
            var versionLabel = document.createElement('div');
            versionLabel.innerText = 'v1.1';
            versionLabel.style.cssText =
                'position: absolute; top: 5px; right: 8px; font-size: 8px; color: #666;';

            // REC Button
            var btnRec = document.createElement('button');
            btnRec.innerText = '● REC';
            btnRec.style.cssText =
                'background: #ff4d4d; color: white; border: none; padding: 10px 20px;' +
                'border-radius: 6px; cursor: pointer; font-weight: bold;' +
                'display: ' + (isRecording ? 'none' : 'block') + ';';

            // SAVE Button
            var btnStop = document.createElement('button');
            btnStop.innerText = '■ SAVE';
            btnStop.style.cssText =
                'background: #4dff88; color: #000; border: none; padding: 10px 20px;' +
                'border-radius: 6px; cursor: pointer; font-weight: bold;' +
                'display: ' + (isRecording ? 'block' : 'none') + ';';

            // Status Label
            var statusLabel = document.createElement('div');
            statusLabel.innerText = isRecording ? 'Recording...' : 'Ready';
            statusLabel.style.cssText =
                'color: ' + (isRecording ? 'red' : '#aaa') + '; font-size: 10px;' +
                'margin-top: 5px; text-align: center;';

            // Timer display
            var timerLabel = document.createElement('div');
            timerLabel.style.cssText = 'color: #ff4d4d; font-size: 14px; text-align: center; display: none;';
            var timerInterval = null;
            var startTime = null;

            function updateTimer() {
                if (!startTime) return;
                var elapsed = Math.floor((Date.now() - startTime) / 1000);
                var mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
                var secs = (elapsed % 60).toString().padStart(2, '0');
                timerLabel.innerText = mins + ':' + secs;
            }

            function startTimer() {
                startTime = Date.now();
                timerLabel.style.display = 'block';
                updateTimer();
                timerInterval = setInterval(updateTimer, 1000);
            }

            function stopTimer() {
                if (timerInterval) clearInterval(timerInterval);
                timerInterval = null;
                startTime = null;
                timerLabel.style.display = 'none';
            }

            // If already recording, start timer
            if (isRecording) {
                startTimer();
            }

            // Resize handle
            var resizeHandle = document.createElement('div');
            resizeHandle.style.cssText =
                'position: absolute; bottom: 0; right: 0; width: 15px; height: 15px;' +
                'cursor: nwse-resize; background: linear-gradient(135deg, transparent 50%, #666 50%);' +
                'border-bottom-right-radius: 12px;';

            // Event handlers
            btnRec.onclick = function (e) {
                e.stopPropagation();
                if (window.nodeStartRecording) {
                    window.nodeStartRecording().then(function () {
                        btnRec.style.display = 'none';
                        btnStop.style.display = 'block';
                        div.style.border = '2px solid red';
                        statusLabel.innerText = 'Recording...';
                        statusLabel.style.color = 'red';
                        startTimer();
                    }).catch(function (err) {
                        statusLabel.innerText = 'Error!';
                        statusLabel.style.color = '#ff6b6b';
                    });
                }
            };

            btnStop.onclick = function (e) {
                e.stopPropagation();
                if (window.nodeStopRecording) {
                    window.nodeStopRecording().then(function () {
                        btnStop.style.display = 'none';
                        btnRec.style.display = 'block';
                        div.style.border = '1px solid #444';
                        statusLabel.innerText = 'Saved!';
                        statusLabel.style.color = '#4dff88';
                        stopTimer();
                        setTimeout(function () {
                            statusLabel.innerText = 'Ready';
                            statusLabel.style.color = '#aaa';
                        }, 2000);
                    }).catch(function (err) {
                        statusLabel.innerText = 'Error!';
                        statusLabel.style.color = '#ff6b6b';
                    });
                }
            };

            // Build UI
            var wrapper = document.createElement('div');
            wrapper.style.cssText = 'display: flex; gap: 10px;';
            wrapper.appendChild(btnRec);
            wrapper.appendChild(btnStop);
            div.appendChild(versionLabel);
            div.appendChild(wrapper);
            div.appendChild(timerLabel);
            div.appendChild(statusLabel);
            div.appendChild(resizeHandle);
            document.body.appendChild(div);

            console.log('Vibe Logger: UI Panel created successfully!');

            // ========================================
            // DRAG & DROP LOGIC
            // ========================================
            var isDragging = false;
            var dragOffsetX = 0;
            var dragOffsetY = 0;

            div.addEventListener('mousedown', function (e) {
                if (e.target === btnRec || e.target === btnStop || e.target === resizeHandle) return;
                isDragging = true;
                dragOffsetX = e.clientX - div.offsetLeft;
                dragOffsetY = e.clientY - div.offsetTop;
                div.style.cursor = 'grabbing';
                e.preventDefault();
            });

            document.addEventListener('mousemove', function (e) {
                if (!isDragging) return;
                var newLeft = e.clientX - dragOffsetX;
                var newTop = e.clientY - dragOffsetY;
                var maxLeft = window.innerWidth - div.offsetWidth;
                var maxTop = window.innerHeight - div.offsetHeight;
                div.style.left = Math.max(0, Math.min(newLeft, maxLeft)) + 'px';
                div.style.top = Math.max(0, Math.min(newTop, maxTop)) + 'px';
                div.style.bottom = 'auto';
                div.style.right = 'auto';
            });

            document.addEventListener('mouseup', function () {
                if (isDragging) {
                    isDragging = false;
                    div.style.cursor = 'move';
                }
            });

            // ========================================
            // RESIZE LOGIC
            // ========================================
            var isResizing = false;
            var resizeStartX = 0;
            var resizeStartY = 0;
            var resizeStartWidth = 0;
            var resizeStartHeight = 0;

            resizeHandle.addEventListener('mousedown', function (e) {
                isResizing = true;
                resizeStartX = e.clientX;
                resizeStartY = e.clientY;
                resizeStartWidth = div.offsetWidth;
                resizeStartHeight = div.offsetHeight;
                e.stopPropagation();
                e.preventDefault();
            });

            document.addEventListener('mousemove', function (e) {
                if (!isResizing) return;
                var deltaX = e.clientX - resizeStartX;
                var deltaY = e.clientY - resizeStartY;
                div.style.width = Math.max(200, resizeStartWidth + deltaX) + 'px';
                div.style.height = Math.max(80, resizeStartHeight + deltaY) + 'px';
            });

            document.addEventListener('mouseup', function () {
                if (isResizing) isResizing = false;
            });
        }

        // Get recording state and setup UI
        if (window.nodeGetRecordingState) {
            window.nodeGetRecordingState().then(setupUI).catch(function () { setupUI(false); });
        } else {
            setupUI(false);
        }
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initUI);
    } else {
        initUI();
    }

})();
