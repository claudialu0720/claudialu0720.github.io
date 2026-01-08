/**
 * OUT OF ARCHITECTURE - Main JavaScript
 * 
 * A clean, simple implementation that:
 * - Handles hero-to-navbar morphing animation on scroll
 * - Renders category grid from JSON data
 * - Shows popover for items with both article + video
 * - Opens video modal for Bilibili links
 * - QR code lightbox functionality
 * 
 * @author Architecture Outlier Team
 */

/* ============================================
   CONFIGURATION
   ============================================ */

const DATA_PATH = 'data/careers.json';

/**
 * Hero animation configuration.
 * Uses fixed positioning to avoid layout feedback loops.
 */
const HERO_CONFIG = {
    // Starting values (hero state)
    heroHeight: window.innerHeight,  // 100vh
    logoHeightStart: 400,            // Smaller starting logo (less shrink = smoother)
    
    // Ending values (navbar state) - responsive based on screen width
    get navbarHeight() {
        const width = window.innerWidth;
        if (width <= 360) return 100;
        if (width <= 480) return 110;
        if (width <= 640) return 130;
        if (width <= 768) return 150;
        return 200;  // Desktop default
    },
    
    get logoHeightEnd() {
        const width = window.innerWidth;
        if (width <= 360) return 80;
        if (width <= 480) return 90;
        if (width <= 640) return 110;
        if (width <= 768) return 130;
        return 160;  // Desktop default
    },
    
    // Animation scroll distance
    get scrollDistance() {
        return this.heroHeight - this.navbarHeight;
    }
};

/* ============================================
   DOM ELEMENT CACHE
   Store references to frequently used elements
   ============================================ */

const elements = {
    // Hero elements
    hero: document.getElementById('hero'),
    heroSpacer: document.getElementById('hero-spacer'),
    heroLogoImg: document.querySelector('.hero__logo-img'),
    heroNav: document.querySelector('.hero__nav'),
    heroScrollIndicator: document.querySelector('.hero__scroll-indicator'),
    
    // Grid container
    categoriesGrid: document.getElementById('categories-grid'),
    
    // Popover elements
    popover: document.getElementById('popover'),
    popoverBackdrop: document.getElementById('popover-backdrop'),
    popoverLinks: document.getElementById('popover-links'),
    popoverClose: document.querySelector('.popover__close'),
    
    // Video modal
    videoModal: document.getElementById('video-modal'),
    videoModalContent: document.getElementById('video-modal-content'),
    videoModalClose: document.querySelector('.video-modal__close'),
    videoModalOverlay: document.querySelector('.video-modal__overlay'),
    
    // QR lightbox
    qrLightbox: document.getElementById('qr-lightbox'),
    qrLightboxImage: document.getElementById('qr-lightbox-image'),
    qrLightboxClose: document.querySelector('.qr-lightbox__close')
};

/* ============================================
   STATE
   Track current UI state
   ============================================ */

let currentPopoverTarget = null;
let lastScrollY = 0;
let isCollapsed = false;
let mouseOverPopover = false;   // Track if mouse is over popover
let currentHoveredItem = null;  // Track currently hovered item element
let popoverCloseTimeout = null; // Timeout for delayed popover close

/* ============================================
   SCROLL HANDLER - HERO MORPHING ANIMATION
   Directly manipulates element styles for
   smooth, flicker-free animation.
   ============================================ */

/**
 * Easing function for smoother animation.
 * Uses ease-out cubic for natural deceleration.
 * @param {number} t - Progress value from 0 to 1
 * @returns {number} Eased value
 */
function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
}

/**
 * Linear interpolation between two values.
 * @param {number} start - Starting value
 * @param {number} end - Ending value
 * @param {number} progress - Progress from 0 to 1
 * @returns {number} Interpolated value
 */
function lerp(start, end, progress) {
    return start + (end - start) * progress;
}

/**
 * Updates hero morphing animation based on scroll position.
 * Directly sets element styles for best performance.
 * Uses fixed positioning so no layout recalculations occur.
 */
function handleHeroScroll() {
    const scrollY = window.scrollY;
    
    // Skip if scroll position hasn't changed significantly
    if (Math.abs(scrollY - lastScrollY) < 0.5) {
        return;
    }
    lastScrollY = scrollY;
    
    // Calculate raw progress (0 to 1+)
    const rawProgress = scrollY / HERO_CONFIG.scrollDistance;
    
    // Clamp progress between 0 and 1
    const progress = Math.min(Math.max(rawProgress, 0), 1);
    
    // Use linear progress for hero/logo shrinking (no easing)
    // This gives smooth, constant-rate shrinking
    // Round to integers to prevent sub-pixel rendering jitter/wobble
    const currentHeight = Math.round(lerp(
        HERO_CONFIG.heroHeight,
        HERO_CONFIG.navbarHeight,
        progress  // Linear - no easing
    ));
    
    const currentLogoHeight = Math.round(lerp(
        HERO_CONFIG.logoHeightStart,
        HERO_CONFIG.logoHeightEnd,
        progress  // Linear - no easing
    ));
    
    // Nav fades in during last 40% of animation (keep easing for fade)
    const navProgress = Math.max(0, (progress - 0.6) * 2.5);
    const navOpacity = Math.min(navProgress, 1);  // Linear fade
    
    // Scroll indicator fades out during first 30% of scroll
    // and is completely hidden after to prevent overlap with logo
    const scrollIndicatorOpacity = 1 - Math.min(progress / 0.3, 1);
    const scrollIndicatorHidden = progress > 0.3;
    
    // Apply styles directly to elements (faster than CSS variables)
    if (elements.hero) {
        elements.hero.style.height = `${currentHeight}px`;
    }
    
    if (elements.heroLogoImg) {
        elements.heroLogoImg.style.height = `${currentLogoHeight}px`;
    }
    
    if (elements.heroNav) {
        elements.heroNav.style.opacity = navOpacity;
    }
    
    if (elements.heroScrollIndicator) {
        elements.heroScrollIndicator.style.opacity = scrollIndicatorOpacity;
        // Completely hide after fade completes to prevent position overlap
        elements.heroScrollIndicator.style.visibility = scrollIndicatorHidden ? 'hidden' : 'visible';
    }
    
    // Toggle collapsed class for border and layout changes
    const shouldBeCollapsed = progress >= 0.95;
    if (shouldBeCollapsed !== isCollapsed) {
        isCollapsed = shouldBeCollapsed;
        if (isCollapsed) {
            elements.hero.classList.add('is-collapsed');
            // Add static navbar class and clear inline styles so CSS takes over
            // This ensures responsive styles work correctly on mobile/tablet
            elements.hero.classList.add('hero--static-navbar');
            elements.hero.style.height = '';
            if (elements.heroLogoImg) {
                elements.heroLogoImg.style.height = '';
            }
            // Remember that user has seen the hero animation
            // So subsequent page loads skip directly to navbar state
            try {
                sessionStorage.setItem('heroSeen', 'true');
            } catch (e) {
                // sessionStorage might be unavailable (private browsing, etc.)
            }
        } else {
            elements.hero.classList.remove('is-collapsed');
            elements.hero.classList.remove('hero--static-navbar');
        }
    }
}

/**
 * Initialize scroll listener with requestAnimationFrame for performance.
 * Uses passive listener for better scroll performance.
 * Skips animation setup for pages with static navbar (e.g., About page).
 */
function initScrollListener() {
    // Check if this page uses static navbar (About page, etc.)
    // If so, skip scroll animation - navbar is already in final state
    let isStaticNavbar = elements.hero && elements.hero.classList.contains('hero--static-navbar');
    
    // Also check if user has already seen the hero animation in this session
    // If so, skip to navbar state for better navigation experience
    if (!isStaticNavbar && elements.hero) {
        try {
            const heroSeen = sessionStorage.getItem('heroSeen');
            if (heroSeen === 'true') {
                // Add static navbar class to skip animation
                elements.hero.classList.add('hero--static-navbar');
                // Hide the spacer completely - grid-section padding handles the offset
                if (elements.heroSpacer) {
                    elements.heroSpacer.style.display = 'none';
                }
                // Scroll to top so content is fully visible
                window.scrollTo(0, 0);
                isStaticNavbar = true;
            }
        } catch (e) {
            // sessionStorage might be unavailable
        }
    }
    
    if (isStaticNavbar) {
        // Static navbar pages don't need scroll animation or spacer height override
        // CSS handles everything via .hero--static-navbar class
        return;
    }
    
    let ticking = false;
    
    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                handleHeroScroll();
                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });
    
    // Handle window resize to update configuration
    window.addEventListener('resize', () => {
        // Update config values
        HERO_CONFIG.heroHeight = window.innerHeight;
        // scrollDistance is now a getter, auto-updates
        
        // Update spacer height
        if (elements.heroSpacer) {
            elements.heroSpacer.style.height = `${window.innerHeight}px`;
        }
        
        // Recalculate current state
        lastScrollY = -1; // Force update
        handleHeroScroll();
    });
    
    // Set initial spacer height
    if (elements.heroSpacer) {
        elements.heroSpacer.style.height = `${window.innerHeight}px`;
    }
    
    // Set initial state
    handleHeroScroll();
}

/* ============================================
   DATA LOADING
   Fetch career data from JSON file
   ============================================ */

/**
 * Loads career data from JSON file.
 * @returns {Promise<Object|null>} Parsed data or null on error.
 */
async function loadCareerData() {
    try {
        const response = await fetch(DATA_PATH);
        
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Failed to load career data:', error);
        showError('Unable to load data. Please refresh the page.');
        return null;
    }
}

/**
 * Shows error message in grid area.
 * @param {string} message - Error message to display.
 */
function showError(message) {
    elements.categoriesGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: #888;">
            <p>${message}</p>
        </div>
    `;
}

/* ============================================
   GRID RENDERING
   Build category columns from data
   ============================================ */

/**
 * Renders the entire category grid.
 * Each category becomes a column with its subcategories listed below.
 * @param {Object} data - Career data with categories array.
 */
function renderGrid(data) {
    if (!data || !data.categories) {
        showError('No categories found.');
        return;
    }
    
    // Clear existing content
    elements.categoriesGrid.innerHTML = '';
    
    // Create column for each category
    data.categories.forEach((category, catIndex) => {
        const column = buildCategoryColumn(category, catIndex);
        elements.categoriesGrid.appendChild(column);
    });
}

/**
 * Creates a category column with header and subcategory items.
 * @param {Object} category - Category object with name and subcategories.
 * @param {number} catIndex - Category index for animation delay.
 * @returns {HTMLElement} The column element.
 */
function buildCategoryColumn(category, catIndex) {
    // Create column container
    const column = document.createElement('div');
    column.className = 'category-column';
    
    // Add header
    const header = document.createElement('h2');
    header.className = 'category-header';
    header.textContent = category.name;
    column.appendChild(header);
    
    // Add subcategory items
    if (category.subcategories && category.subcategories.length > 0) {
        category.subcategories.forEach((sub, subIndex) => {
            const item = buildSubcategoryItem(sub, catIndex, subIndex);
            column.appendChild(item);
        });
    }
    
    return column;
}

/**
 * Creates a subcategory item.
 * Clicking any subcategory opens the popup showing all projects/people.
 * 
 * @param {Object} sub - Subcategory object with name and projects array.
 * @param {number} catIndex - Category index for stagger animation.
 * @param {number} subIndex - Subcategory index for stagger animation.
 * @returns {HTMLElement} The subcategory item element.
 */
function buildSubcategoryItem(sub, catIndex, subIndex) {
    const item = document.createElement('div');
    item.className = 'subcategory-card';
    
    // Staggered animation delay
    const delay = (catIndex * 0.03) + (subIndex * 0.08);
    item.style.animationDelay = `${delay}s`;
    
    // Create text span
    const nameSpan = document.createElement('span');
    nameSpan.className = 'subcategory-card__name';
    nameSpan.textContent = sub.name;
    item.appendChild(nameSpan);
    
    // Hover handler - open popup on mouse enter
    item.addEventListener('mouseenter', () => {
        currentHoveredItem = item;
        
        // Cancel any pending close
        cancelPopoverClose();
        
        // Open popover immediately (no delay - feels more responsive)
        openPopover(sub, item);
    });
    
    // Close popup when mouse leaves - with generous delay
    item.addEventListener('mouseleave', () => {
        // Only clear if this is the item we're leaving
        if (currentHoveredItem === item) {
            currentHoveredItem = null;
        }
        
        // Delay close to allow mouse to reach popover
        schedulePopoverClose();
    });
    
    // Keyboard accessibility - open on focus
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.addEventListener('focus', () => {
        currentHoveredItem = item;
        openPopover(sub, item);
    });
    item.addEventListener('blur', () => {
        currentHoveredItem = null;
        schedulePopoverClose();
    });
    
    return item;
}

/* ============================================
   POPOVER FUNCTIONALITY
   Shows article/video links next to clicked item
   ============================================ */

/**
 * Gets projects array from subcategory data.
 * Handles backward compatibility with old format (articleUrl/videoUrl directly on sub).
 * @param {Object} sub - Subcategory data.
 * @returns {Array} Array of project objects.
 */
function getProjectsFromSub(sub) {
    // New format: projects array exists
    if (sub.projects && Array.isArray(sub.projects)) {
        return sub.projects;
    }
    
    // Old format: articleUrl/videoUrl directly on subcategory
    // Convert to single-item projects array for backward compatibility
    if (sub.articleUrl || sub.videoUrl) {
        return [{
            personName: null,
            personUrl: null,
            articleUrl: sub.articleUrl,
            videoUrl: sub.videoUrl
        }];
    }
    
    // No projects
    return [];
}

/**
 * Opens the popover next to the clicked item.
 * Shows all projects/people under the subcategory.
 * @param {Object} sub - Subcategory data.
 * @param {HTMLElement} target - The clicked element.
 */
function openPopover(sub, target) {
    // Store reference for repositioning
    currentPopoverTarget = target;
    
    // Clear and rebuild links
    elements.popoverLinks.innerHTML = '';
    
    // Get projects array (handles both old and new format)
    const projects = getProjectsFromSub(sub);
    
    // If no projects, show "Under Construction"
    if (projects.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'popover__empty';
        emptyMessage.textContent = 'Under Construction';
        elements.popoverLinks.appendChild(emptyMessage);
    } else {
        // Render each project
        projects.forEach((project, index) => {
            const projectEl = buildProjectEntry(project);
            elements.popoverLinks.appendChild(projectEl);
            
            // Add separator between projects (if more than one)
            if (index < projects.length - 1) {
                const separator = document.createElement('hr');
                separator.className = 'popover__separator';
                elements.popoverLinks.appendChild(separator);
            }
        });
    }
    
    // Position and show
    positionPopover(target);
    elements.popover.classList.add('is-open');
    elements.popoverBackdrop.classList.add('is-open');
    elements.popover.setAttribute('aria-hidden', 'false');
}

/**
 * Builds a single project entry for the popover.
 * Shows person name (with optional link) and article/video links.
 * @param {Object} project - Project object with personName, personUrl, articleUrl, videoUrl.
 * @returns {HTMLElement} The project entry element.
 */
function buildProjectEntry(project) {
    const container = document.createElement('div');
    container.className = 'popover__project';
    
    // Person name (if provided)
    if (project.personName) {
        const nameEl = document.createElement('div');
        nameEl.className = 'popover__person-name';
        
        if (project.personUrl) {
            // Name with link
            const nameLink = document.createElement('a');
            nameLink.href = project.personUrl;
            nameLink.target = '_blank';
            nameLink.rel = 'noopener noreferrer';
            nameLink.textContent = project.personName;
            nameEl.appendChild(nameLink);
        } else {
            // Name without link
            nameEl.textContent = project.personName;
        }
        
        container.appendChild(nameEl);
    }
    
    // Links container
    const linksContainer = document.createElement('div');
    linksContainer.className = 'popover__project-links';
    
    // Video link
    if (project.videoUrl) {
        const videoLink = document.createElement('a');
        videoLink.className = 'popover__link';
        videoLink.href = project.videoUrl;
        videoLink.target = '_blank';
        videoLink.rel = 'noopener noreferrer';
        videoLink.textContent = 'video';
        videoLink.addEventListener('click', (e) => {
            e.preventDefault();
            closePopover();
            openVideoModal(project.videoUrl);
        });
        linksContainer.appendChild(videoLink);
    }
    
    // Article link
    if (project.articleUrl) {
        const articleLink = document.createElement('a');
        articleLink.className = 'popover__link';
        articleLink.href = project.articleUrl;
        articleLink.target = '_blank';
        articleLink.rel = 'noopener noreferrer';
        articleLink.textContent = 'interview text';
        linksContainer.appendChild(articleLink);
    }
    
    // Only add links container if there are links
    if (project.videoUrl || project.articleUrl) {
        container.appendChild(linksContainer);
    }
    
    return container;
}

/**
 * Positions the popover next to the target element.
 * Tries to position to the right, falls back to left or below.
 * @param {HTMLElement} target - Element to position next to.
 */
function positionPopover(target) {
    const rect = target.getBoundingClientRect();
    const popoverWidth = 140;
    const padding = 16;
    
    // Check available space
    const spaceRight = window.innerWidth - rect.right;
    const spaceLeft = rect.left;
    
    let left, top;
    
    // Prefer right side - position directly adjacent (no gap)
    if (spaceRight >= popoverWidth + padding) {
        left = rect.right;  // No gap - directly adjacent
    } else if (spaceLeft >= popoverWidth + padding) {
        left = rect.left - popoverWidth;  // No gap - directly adjacent
    } else {
        // Center horizontally
        left = Math.max(padding, (window.innerWidth - popoverWidth) / 2);
    }
    
    // Vertical: align with top of target
    top = rect.top;
    
    // Keep in viewport
    if (top + 100 > window.innerHeight - padding) {
        top = window.innerHeight - 100 - padding;
    }
    if (top < padding) {
        top = padding;
    }
    
    // Apply position
    elements.popover.style.left = `${left}px`;
    elements.popover.style.top = `${top}px`;
}

/**
 * Closes the popover.
 */
function closePopover() {
    elements.popover.classList.remove('is-open');
    elements.popoverBackdrop.classList.remove('is-open');
    elements.popover.setAttribute('aria-hidden', 'true');
    currentPopoverTarget = null;
}

/**
 * Checks if mouse is currently over the popover or item.
 * @returns {boolean} True if mouse is over popover or item.
 */
function isMouseOverPopoverOrItem() {
    return mouseOverPopover || currentHoveredItem !== null;
}

/**
 * Schedules the popover to close after a delay.
 * Allows user time to move mouse from item to popover.
 */
function schedulePopoverClose() {
    // Cancel any existing close timeout
    if (popoverCloseTimeout) {
        clearTimeout(popoverCloseTimeout);
    }
    
    // Schedule close with generous delay (300ms)
    popoverCloseTimeout = setTimeout(() => {
        if (!isMouseOverPopoverOrItem()) {
            closePopover();
        }
        popoverCloseTimeout = null;
    }, 300);
}

/**
 * Cancels any scheduled popover close.
 */
function cancelPopoverClose() {
    if (popoverCloseTimeout) {
        clearTimeout(popoverCloseTimeout);
        popoverCloseTimeout = null;
    }
}

/**
 * Initialize popover event listeners.
 * Skips if popover elements don't exist (e.g., About page).
 */
function initPopoverListeners() {
    // Skip if popover elements don't exist on this page
    if (!elements.popover || !elements.popoverBackdrop) {
        return;
    }
    
    // Track mouse over popover - cancel close when entering
    elements.popover.addEventListener('mouseenter', () => {
        mouseOverPopover = true;
        cancelPopoverClose();
    });
    
    // Schedule close when leaving popover
    elements.popover.addEventListener('mouseleave', () => {
        mouseOverPopover = false;
        schedulePopoverClose();
    });
    
    // Close on backdrop click (for mobile/touch)
    elements.popoverBackdrop.addEventListener('click', closePopover);
    
    // Close on close button
    if (elements.popoverClose) {
        elements.popoverClose.addEventListener('click', closePopover);
    }
    
    // Reposition on resize
    window.addEventListener('resize', () => {
        if (currentPopoverTarget && elements.popover.classList.contains('is-open')) {
            positionPopover(currentPopoverTarget);
        }
    });
}

/* ============================================
   VIDEO MODAL
   Full-screen Bilibili player
   ============================================ */

/**
 * Extracts Bilibili video ID (bvid) from URL.
 * Handles URLs like: https://www.bilibili.com/video/BV1Di4y187NW/?share_source=...
 * @param {string} url - Bilibili URL.
 * @returns {string|null} BV ID or null.
 */
function extractBilibiliId(url) {
    if (!url) return null;
    
    // Match BV ID pattern - starts with "BV" followed by alphanumeric characters
    // URL format: bilibili.com/video/BVxxxxxxxxxx
    const pattern = /bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/;
    const match = url.match(pattern);
    
    if (match && match[1]) {
        return match[1];
    }
    
    return null;
}

/**
 * Opens the video modal with a Bilibili embed.
 * @param {string} videoUrl - Bilibili video URL.
 */
function openVideoModal(videoUrl) {
    const bvid = extractBilibiliId(videoUrl);
    
    if (!bvid) {
        // Fallback: open URL directly in new tab
        window.open(videoUrl, '_blank');
        return;
    }
    
    // Create Bilibili iframe embed
    // isOutside=true is required for external website embedding
    const iframe = document.createElement('iframe');
    iframe.src = `//player.bilibili.com/player.html?isOutside=true&bvid=${bvid}&autoplay=1`;
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('border', '0');
    iframe.setAttribute('frameborder', 'no');
    iframe.setAttribute('framespacing', '0');
    iframe.setAttribute('allowfullscreen', 'true');
    
    // Add to modal
    elements.videoModalContent.innerHTML = '';
    elements.videoModalContent.appendChild(iframe);
    
    // Show modal
    elements.videoModal.classList.add('is-open');
    elements.videoModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
}

/**
 * Closes the video modal.
 */
function closeVideoModal() {
    elements.videoModal.classList.remove('is-open');
    elements.videoModal.setAttribute('aria-hidden', 'true');
    elements.videoModalContent.innerHTML = '';
    document.body.style.overflow = '';
}

/**
 * Initialize video modal listeners.
 */
function initVideoModalListeners() {
    if (elements.videoModalClose) {
        elements.videoModalClose.addEventListener('click', closeVideoModal);
    }
    
    if (elements.videoModalOverlay) {
        elements.videoModalOverlay.addEventListener('click', closeVideoModal);
    }
}

/* ============================================
   QR CODE LIGHTBOX
   Enlarged view of QR codes
   ============================================ */

/**
 * Opens QR lightbox with given image.
 * @param {string} imageSrc - Image source URL.
 */
function openQrLightbox(imageSrc) {
    if (elements.qrLightboxImage) {
        elements.qrLightboxImage.src = imageSrc;
    }
    if (elements.qrLightbox) {
        elements.qrLightbox.classList.add('is-open');
        elements.qrLightbox.setAttribute('aria-hidden', 'false');
    }
}

/**
 * Closes the QR lightbox.
 */
function closeQrLightbox() {
    if (elements.qrLightbox) {
        elements.qrLightbox.classList.remove('is-open');
        elements.qrLightbox.setAttribute('aria-hidden', 'true');
    }
}

/**
 * Initialize QR lightbox listeners.
 */
function initQrLightboxListeners() {
    // Click on QR codes to open lightbox
    const qrCodes = document.querySelectorAll('.contact__qr-code');
    qrCodes.forEach(qr => {
        qr.addEventListener('click', () => {
            const img = qr.querySelector('img');
            if (img) {
                openQrLightbox(img.src);
            }
        });
    });
    
    // Close button
    if (elements.qrLightboxClose) {
        elements.qrLightboxClose.addEventListener('click', closeQrLightbox);
    }
    
    // Click outside to close
    if (elements.qrLightbox) {
        elements.qrLightbox.addEventListener('click', (e) => {
            if (e.target === elements.qrLightbox) {
                closeQrLightbox();
            }
        });
    }
}

/* ============================================
   KEYBOARD HANDLING
   Global escape key handler
   ============================================ */

/**
 * Initialize global keyboard listeners.
 */
function initKeyboardListeners() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // Close in order of priority
            if (elements.qrLightbox && elements.qrLightbox.classList.contains('is-open')) {
                closeQrLightbox();
            } else if (elements.videoModal && elements.videoModal.classList.contains('is-open')) {
                closeVideoModal();
            } else if (elements.popover.classList.contains('is-open')) {
                closePopover();
            }
        }
    });
}

/* ============================================
   INITIALIZATION
   Main entry point
   ============================================ */

/**
 * Initialize all functionality.
 */
async function init() {
    console.log('Architecture Outlier - Initializing...');
    
    // Setup event listeners
    initScrollListener();
    initPopoverListeners();
    initVideoModalListeners();
    initQrLightboxListeners();
    initKeyboardListeners();
    
    // Load and render data
    const data = await loadCareerData();
    if (data) {
        renderGrid(data);
    }
    
    console.log('Architecture Outlier - Ready!');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
