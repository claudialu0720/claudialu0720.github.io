document.addEventListener('DOMContentLoaded', () => {
    // Initialize the portfolio
    initPortfolio();
    
    // Full-screen Gallery Variables
    let galleryImages = [];
    let currentGalleryIndex = 0;
    const fullscreenGallery = document.getElementById('fullscreen-gallery');
    const fullscreenImage = document.getElementById('fullscreen-image');
    const closeGalleryBtn = document.querySelector('.close-gallery-btn');
    const prevGalleryBtn = document.querySelector('.prev-gallery-btn');
    const nextGalleryBtn = document.querySelector('.next-gallery-btn');
    
    // Intersection Observer for lazy loading images
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                // Load the actual image
                loadImage(img);
                observer.unobserve(img);
            }
        });
    }, {
        // Start loading when image is 50px away from viewport
        rootMargin: '50px',
        threshold: 0.01
    });

    /**
     * Main function to initialize the portfolio
     */
    async function initPortfolio() {
        // Get container
        const container = document.getElementById('portfolio-container');
        
        // Render all sections
        await renderSections(container);
        
        // Add event listeners for project thumbnails
        addEventListeners();
    }
    
    /**
     * Render all portfolio sections into the container
     * @param {HTMLElement} container - The container element
     */
    async function renderSections(container) {
        // Get the section template
        const sectionTemplate = document.getElementById('section-template');
        
        // Create array to hold all section loading promises
        const sectionPromises = [];
        
        // For each section in the config
        for (const sectionData of portfolioConfig.sections) {
            // Clone the section template
            const sectionElement = sectionTemplate.content.cloneNode(true).querySelector('.portfolio-section');
            
            // Set section ID
            sectionElement.id = sectionData.id;
            
            // Set section title
            sectionElement.querySelector('.section-title').textContent = sectionData.title;
            
            // Add the section to the container immediately
            container.appendChild(sectionElement);
            
            // Get the section content element
            const sectionContentElement = sectionElement.querySelector('.section-content');
            
            // Create promise for loading this section's projects (don't await here)
            const sectionPromise = loadProjects(sectionContentElement, sectionData.directory)
                .then(() => {
                })
                .catch((error) => {
                    console.error(`Error loading section ${sectionData.title}:`, error);
                });
            
            sectionPromises.push(sectionPromise);
        }
        
        // Wait for all sections to load in parallel
        await Promise.all(sectionPromises);
    }
    
    /**
     * Load projects from HTML files in the section directory
     * @param {HTMLElement} sectionContentElement - The section content element
     * @param {string} directory - Directory containing project HTML files
     */
    async function loadProjects(sectionContentElement, directory) {
        try {
            // Fetch the list of project files
            const response = await fetch(`${directory}/index.json`);
            
            // If the index file doesn't exist, we'll handle the error
            if (!response.ok) {
                console.warn(`No index.json found in ${directory}. Loading files individually.`);
                return;
            }
            
            const projectFiles = await response.json();
            
            // Load each project from its HTML file
            for (const projectFile of projectFiles) {
                await loadProjectFromFile(sectionContentElement, `${directory}/${projectFile}`);
            }
        } catch (error) {
            console.warn(`Error loading project index: ${error}. Using directory listing instead.`);
            
            // Fallback: Load projects directly from the directory
            // Note: This approach would normally require server-side listing of files
            // For demo purposes, we'll enumerate some sample files
            
            const files = getProjectFilesForDirectory(directory);
            
            // Load each project
            for (const file of files) {
                await loadProjectFromFile(sectionContentElement, file);
            }
        }
    }
    
    /**
     * Get project files for a directory (simulated)
     * This would normally be done on the server side with a directory listing
     * @param {string} directory - Directory path
     * @returns {Array} - Array of file paths
     */
    function getProjectFilesForDirectory(directory) {
        return (directoryFiles[directory] || []).map(file => `${directory}/${file}`);
    }
    
    /**
     * Load a project from its HTML file
     * @param {HTMLElement} sectionContentElement - The section content element
     * @param {string} filePath - Path to the project HTML file
     */
    async function loadProjectFromFile(sectionContentElement, filePath) {
        try {
            // Fetch the project HTML file
            const response = await fetch(filePath);
            
            if (!response.ok) {
                throw new Error(`Failed to load ${filePath}`);
            }
            
            let html = await response.text();
            
            // Preprocess HTML to convert images for lazy loading BEFORE creating DOM
            html = preprocessHTMLForLazyLoading(html, false);
            
            // Create a temporary element to parse the processed HTML
            const tempElement = document.createElement('div');
            tempElement.innerHTML = html;
            
            // Get the project preview content
            const projectPreview = tempElement.querySelector('.project-preview');
            
            if (!projectPreview) {
                throw new Error(`No project preview found in ${filePath}`);
            }
            
            // Create a project item container
            const projectItem = document.createElement('div');
            projectItem.className = 'project-item';
            projectItem.dataset.projectFile = filePath;
            
            // Add the preview content to the project item
            const clonedPreview = projectPreview.cloneNode(true);
            projectItem.appendChild(clonedPreview);
            
            // Setup lazy loading for any data-src images that were created by preprocessing
            setupLazyLoading(projectItem);
            
            // Add the project to the section content
            sectionContentElement.appendChild(projectItem);
            
        } catch (error) {
            console.error(`Error loading project: ${error}`);
        }
    }
    
    /**
     * Add event listeners to all project thumbnails and overlays
     */
    function addEventListeners() {
        // Add click listeners for thumbnails
        document.querySelectorAll('.project-item .project-thumbnail').forEach(thumbnail => {
            thumbnail.addEventListener('click', async (event) => {
                event.stopPropagation();
                
                // Get the project item element
                const projectItem = thumbnail.closest('.project-item');
                
                // Check for external link on the project-preview div
                const projectPreview = projectItem.querySelector('.project-preview');
                const externalLink = projectPreview ? projectPreview.dataset.externalLink : null;
                
                if (externalLink) {
                    window.open(externalLink, '_blank');
                } else {
                    // Get the project file path
                    const projectFilePath = projectItem.dataset.projectFile;
                    
                    // Get the section element
                    const sectionElement = thumbnail.closest('.portfolio-section');
                    
                    // Open the project detail
                    await openProjectDetail(projectFilePath, sectionElement);
                }
            });
        });
        
        // Add click listeners for "[More...]" links
        document.querySelectorAll('.project-item .project-more-link').forEach(moreLink => {
            moreLink.addEventListener('click', async (event) => {
                event.stopPropagation();
                const projectItem = moreLink.closest('.project-item');
                const projectPreview = projectItem.querySelector('.project-preview');
                const externalLink = projectPreview ? projectPreview.dataset.externalLink : null;

                if (externalLink) {
                    window.open(externalLink, '_blank');
                } else {
                    const projectFilePath = projectItem.dataset.projectFile;
                    const sectionElement = moreLink.closest('.portfolio-section');
                    await openProjectDetail(projectFilePath, sectionElement);
                }
            });
        });
        
        // Add event listener to close when clicking outside a detail
        document.addEventListener('click', (event) => {
            // Check if click is on a portfolio section but not on a detail or thumbnail
            if (event.target.closest('.portfolio-section') && 
                !event.target.closest('.project-detail') && 
                !event.target.closest('.project-thumbnail')) {
                
                // Find the active detail in the section
                const activeDetail = event.target.closest('.portfolio-section').querySelector('.project-detail');
                
                if (activeDetail) {
                    closeProjectDetail(activeDetail);
                }
            }
        });
    }
    
    /**
     * Open project detail
     * @param {string} projectFilePath - Path to the project HTML file
     * @param {HTMLElement} sectionElement - The section element
     */
    async function openProjectDetail(projectFilePath, sectionElement) {
        try {
            // Fetch the project HTML file
            const response = await fetch(projectFilePath);
            
            if (!response.ok) {
                throw new Error(`Failed to load ${projectFilePath}`);
            }
            
            let html = await response.text();
            
            // Preprocess HTML to convert ALL detail images for lazy loading BEFORE creating DOM
            // (This prevents flash, but we'll load them immediately after)
            html = preprocessHTMLForLazyLoading(html, true);
            
            // Create a temporary element to parse the processed HTML
            const tempElement = document.createElement('div');
            tempElement.innerHTML = html;
            
            // Get the project detail content
            const projectDetailContent = tempElement.querySelector('.project-detail-content');
            
            if (!projectDetailContent) {
                throw new Error(`No project detail content found in ${projectFilePath}`);
            }
            
            // Get project detail template
            const detailTemplate = document.getElementById('project-detail-template');
            
            // Clone the template
            const detailElement = detailTemplate.content.cloneNode(true).querySelector('.project-detail');
            
            // Populate the section title in the detail view header
            const sectionTitle = sectionElement.querySelector('.section-title').textContent;
            detailElement.querySelector('.detail-section-title').textContent = sectionTitle;
            
            // Get the content container
            const contentContainer = detailElement.querySelector('.detail-content');
            
            // Add the detail content to the container
            const clonedDetailContent = projectDetailContent.cloneNode(true);
            contentContainer.appendChild(clonedDetailContent);

            // Add event listeners to images within the detail content for the gallery
            clonedDetailContent.addEventListener('click', (event) => {
                if (event.target.tagName === 'IMG') {
                    // Collect all images from this project's detail view
                    const imagesInDetail = Array.from(clonedDetailContent.querySelectorAll('img')).map(img => {
                        return img.dataset.src || img.src; // Handle both loaded and unloaded images
                    }).filter(src => src); // Filter out empty sources
                    
                    const clickedImageSrc = event.target.dataset.src || event.target.src;
                    openFullscreenGallery(imagesInDetail, clickedImageSrc);
                }
            });
            
            // Add event listener to the close button
            const closeBtn = detailElement.querySelector('.close-btn');
            closeBtn.addEventListener('click', () => {
                closeProjectDetail(detailElement);
            });

            // Add the detail to the section
            sectionElement.appendChild(detailElement);
            
            // Show the detail immediately
            detailElement.classList.add('active');
            
            // Add overlay to other sections
            addOverlayToOtherSections(sectionElement);
            
            // Add click handlers to overlays to close the detail
            addOverlayClickHandlers(sectionElement);
            
            // Load all images in the background (non-blocking)
            loadAllImagesImmediately(clonedDetailContent)
                .then(() => {
                    // Images loaded successfully
                })
                .catch((error) => {
                    console.warn('Some detail images failed to load:', error);
                });
            
        } catch (error) {
            console.error(`Error opening project detail: ${error}`);
        }
    }
    
    /**
     * Add overlay to all sections except the active one
     * @param {HTMLElement} activeSection - The active section element
     */
    function addOverlayToOtherSections(activeSection) {
        // Get all sections
        const allSections = document.querySelectorAll('.portfolio-section');
        
        // For each section
        allSections.forEach(section => {
            // If this is not the active section
            if (section !== activeSection) {
                // Add active class to the overlay
                section.querySelector('.section-overlay').classList.add('active');
            }
        });
    }
    
    /**
     * Add click handlers to all active overlays to close the detail view
     * @param {HTMLElement} activeSection - The active section element 
     */
    function addOverlayClickHandlers(activeSection) {
        // Get all sections
        const allSections = document.querySelectorAll('.portfolio-section');
        
        // For each section
        allSections.forEach(section => {
            // If this is not the active section
            if (section !== activeSection) {
                const overlay = section.querySelector('.section-overlay');
                
                // Add click handler to the overlay
                overlay.addEventListener('click', () => {
                    // Find the active detail
                    const activeDetail = activeSection.querySelector('.project-detail.active');
                    
                    if (activeDetail) {
                        closeProjectDetail(activeDetail);
                    }
                });
            }
        });
    }
    
    /**
     * Remove overlay from all sections
     */
    function removeAllOverlays() {
        // Get all overlays
        const allOverlays = document.querySelectorAll('.section-overlay');
        
        // Remove active class from all overlays
        allOverlays.forEach(overlay => {
            overlay.classList.remove('active');
            
            // Remove click event listeners
            overlay.replaceWith(overlay.cloneNode(true));
        });
    }
    
    /**
     * Close project detail
     * @param {HTMLElement} detailElement - Detail element to close
     */
    function closeProjectDetail(detailElement) {
        // Remove the detail element
        if (detailElement) {
            detailElement.classList.remove('active');
            // Remove overlay from other sections
            removeAllOverlays();
            setTimeout(() => {
                if (detailElement.parentNode) {
                     detailElement.parentNode.removeChild(detailElement);
                }
            }, 300); // Wait for transition
        }
    }

    // --- Full-screen Gallery Functions ---

    /**
     * Opens the full-screen gallery with the provided images.
     * @param {string[]} images - Array of image URLs for the gallery.
     * @param {string} currentImageSrc - The src of the image that was clicked.
     */
    function openFullscreenGallery(images, currentImageSrc) {
        galleryImages = images;
        currentGalleryIndex = galleryImages.indexOf(currentImageSrc);
        if (currentGalleryIndex === -1) currentGalleryIndex = 0; // Fallback

        showGalleryImage(currentGalleryIndex);
        fullscreenGallery.classList.add('active');
        // Add keyboard navigation for gallery
        document.addEventListener('keydown', handleGalleryKeyPress);
    }

    /**
     * Displays the image at the given index in the gallery.
     * @param {number} index - The index of the image to show.
     */
    function showGalleryImage(index) {
        if (index >= 0 && index < galleryImages.length) {
            fullscreenImage.src = galleryImages[index];
            currentGalleryIndex = index;
            // Show/hide prev/next buttons based on index - updated for looping
            const multipleImages = galleryImages.length > 1;
            prevGalleryBtn.style.display = multipleImages ? 'block' : 'none';
            nextGalleryBtn.style.display = multipleImages ? 'block' : 'none';
        }
    }

    /**
     * Closes the full-screen gallery.
     */
    function closeFullscreenGallery() {
        fullscreenGallery.classList.remove('active');
        galleryImages = [];
        currentGalleryIndex = 0;
        // Remove keyboard navigation for gallery
        document.removeEventListener('keydown', handleGalleryKeyPress);
    }

    /**
     * Changes the displayed image in the gallery (next or previous).
     * @param {number} direction - 1 for next, -1 for previous.
     */
    function changeGalleryImage(direction) {
        if (!galleryImages || galleryImages.length === 0) return;

        let newIndex = currentGalleryIndex + direction;

        if (newIndex >= galleryImages.length) {
            newIndex = 0; // Loop to the first image
        } else if (newIndex < 0) {
            newIndex = galleryImages.length - 1; // Loop to the last image
        }
        showGalleryImage(newIndex);
    }

    /**
     * Handles key presses for gallery navigation (left/right arrows, escape).
     * @param {KeyboardEvent} event - The keydown event.
     */
    function handleGalleryKeyPress(event) {
        if (fullscreenGallery.classList.contains('active')) {
            if (event.key === 'ArrowRight' || event.key === 'Right') {
                changeGalleryImage(1);
            } else if (event.key === 'ArrowLeft' || event.key === 'Left') {
                changeGalleryImage(-1);
            } else if (event.key === 'Escape' || event.key === 'Esc') {
                closeFullscreenGallery();
            }
        }
    }

    // Event Listeners for Gallery Controls
    if (closeGalleryBtn) {
        closeGalleryBtn.addEventListener('click', closeFullscreenGallery);
    }
    if (prevGalleryBtn) {
        prevGalleryBtn.addEventListener('click', () => changeGalleryImage(-1));
    }
    if (nextGalleryBtn) {
        nextGalleryBtn.addEventListener('click', () => changeGalleryImage(1));
    }
    // Add event listener to the gallery container for closing when clicking outside the image
    if (fullscreenGallery) {
        fullscreenGallery.addEventListener('click', (event) => {
            // If the click is directly on the gallery background (not the image or buttons)
            if (event.target === fullscreenGallery) {
                closeFullscreenGallery();
            }
        });
    }

    /**
     * Load an image with lazy loading support
     * @param {HTMLImageElement} img - The image element to load
     */
    function loadImage(img) {
        return new Promise((resolve, reject) => {
            const actualImg = new Image();
            
            actualImg.onload = () => {
                img.src = actualImg.src;
                img.classList.remove('lazy-loading');
                img.classList.add('loaded');
                resolve();
            };
            
            actualImg.onerror = () => {
                img.classList.remove('lazy-loading');
                img.classList.add('error');
                reject(new Error(`Failed to load image: ${img.dataset.src || img.src}`));
            };
            
            // Get the actual source from data-src attribute
            const imageSrc = img.dataset.src || img.src;
            if (imageSrc) {
                actualImg.src = imageSrc;
            } else {
                reject(new Error('No image source found'));
            }
        });
    }

    /**
     * Setup lazy loading for images
     * @param {HTMLElement} container - Container element to search for images
     */
    function setupLazyLoading(container) {
        const images = container.querySelectorAll('img[data-src]');
        images.forEach(img => {
            // Add loading placeholder styling (minimal to prevent layout shift)
            img.style.backgroundColor = '#f0f0f0';
            
            // Set appropriate min-height based on context for placeholder
            if (img.closest('.project-thumbnail')) {
                img.style.minHeight = '150px'; // Reduced from 200px to be less restrictive
            } else if (img.closest('.gallery-item')) {
                img.style.minHeight = '100px'; // Reduced from 150px
            } else {
                img.style.minHeight = '50px'; // Reduced from 100px
            }
            
            if (!img.classList.contains('lazy-loading')) {
                img.classList.add('lazy-loading');
            }
            
            // Observe the image for intersection
            imageObserver.observe(img);
        });
    }

    /**
     * Process HTML content to prepare images for lazy loading
     * @param {string} html - The HTML string to process
     * @param {boolean} isDetailContent - Whether this is detail content (more aggressive lazy loading)
     * @returns {string} - The processed HTML string
     */
    function preprocessHTMLForLazyLoading(html, isDetailContent = false) {
        // Process HTML string to convert img src to data-src before DOM creation
        if (isDetailContent) {
            // For detail content, convert ALL images to lazy loading
            html = html.replace(/<img([^>]*)\ssrc=["']([^"']+)["']([^>]*)>/gi, (match, beforeSrc, srcValue, afterSrc) => {
                // Check if this img already has data-src attribute
                if (beforeSrc.includes('data-src') || afterSrc.includes('data-src')) {
                    return match; // Don't modify if already has data-src
                }
                // Convert src to data-src and add lazy-loading class
                const classAttr = afterSrc.includes('class=') 
                    ? afterSrc.replace(/class=["']([^"']*)["']/i, 'class="$1 lazy-loading"')
                    : afterSrc + ' class="lazy-loading"';
                return `<img${beforeSrc} data-src="${srcValue}"${classAttr}>`;
            });
        } else {
            // For homepage content, only load the FIRST image immediately, lazy load everything else
            let imageCount = 0;
            html = html.replace(/<img([^>]*)\ssrc=["']([^"']+)["']([^>]*)>/gi, (match, beforeSrc, srcValue, afterSrc) => {
                imageCount++;
                
                // Check if this img already has data-src attribute
                if (beforeSrc.includes('data-src') || afterSrc.includes('data-src')) {
                    return match; // Don't modify if already has data-src
                }
                
                // Keep only the FIRST image as immediate loading, convert all others to lazy loading
                if (imageCount > 1) { // Changed from 2 to 1
                    const classAttr = afterSrc.includes('class=') 
                        ? afterSrc.replace(/class=["']([^"']*)["']/i, 'class="$1 lazy-loading"')
                        : afterSrc + ' class="lazy-loading"';
                    return `<img${beforeSrc} data-src="${srcValue}"${classAttr}>`;
                }
                
                return match; // Keep only the first image unchanged
            });
        }
        
        return html;
    }

    /**
     * Load all images immediately in a container (for detail views)
     * @param {HTMLElement} container - Container with images to load immediately
     */
    function loadAllImagesImmediately(container) {
        const lazyImages = container.querySelectorAll('img[data-src]');
        
        if (lazyImages.length === 0) {
            return Promise.resolve();
        }
        
        const loadPromises = [];
        
        lazyImages.forEach(img => {
            // Stop observing this image if it's being watched
            try {
                imageObserver.unobserve(img);
            } catch (e) {
                // Image might not be observed, ignore error
            }
            
            // Create a promise for loading this image
            const loadPromise = new Promise((resolve) => { // Always resolve, never reject
                const onLoad = () => {
                    img.classList.remove('lazy-loading');
                    img.classList.add('loaded');
                    cleanup();
                    resolve();
                };
                
                const onError = () => {
                    img.classList.remove('lazy-loading');
                    img.classList.add('error');
                    cleanup();
                    resolve(); // Still resolve, don't let one failed image break everything
                };
                
                const cleanup = () => {
                    img.removeEventListener('load', onLoad);
                    img.removeEventListener('error', onError);
                };
                
                // Set up event listeners before changing src
                img.addEventListener('load', onLoad);
                img.addEventListener('error', onError);
                
                // Start loading the image
                try {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                } catch (e) {
                    console.warn('Failed to set image src:', e);
                    onError();
                }
            });
            
            loadPromises.push(loadPromise);
        });
        
        return Promise.all(loadPromises);
    }
}); 