var express = require('express');
var router = express.Router();
var axios = require('axios'); // Adicionar import do axios

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

// Site configuration
const siteConfig = {
  siteName: "My Digital Diary",
  title: "Digital Diary"
};

// Navigation items
const navItems = [
  { text: "Homepage", url: "/", active: false },
  { text: "Timeline", url: "/timeline", active: false },
  { text: "Categories", url: "/categories", active: false },
  { text: "Tags", url: "/tags", active: false },
  { text: "About", url: "/about", active: false }
];

// Helper function to set active navigation item
const getNavWithActive = (activeUrl) => {
  return navItems.map(item => ({
    ...item,
    active: item.url === activeUrl
  }));
};


/* GET home page. */
router.get('/', async function (req, res, next) { // Declarar função async
  try {

    const response = await axios.get(`${API_URL}/api/entries?limit=3`);
    const entries = response.data;
    
    res.render('homepage', {
      ...siteConfig,
      navItems: getNavWithActive('/'),
      welcomeHeader: "Welcome to My Digital Diary",
      welcomeMessage: "This is my personal digital space where I share my thoughts, experiences, and memories.",
      searchPlaceholder: "Search my diary...",
      searchButtonText: "Search",
      entriesHeader: "Recent Entries",
      entries: entries,
      readMoreText: "Read More",
      noEntriesMessage: "No entries found.",
      scripts: ["js/tag-filter.js"]
    });
  } catch (err) {
    console.error('Error fetching entries from API:', err.message);
    res.status(500).render('error', {
      ...siteConfig,
      navItems: getNavWithActive('/'),
      message: "Error loading entries",
      error: { status: 500 }
    });
  }
});

/* GET timeline page. */
router.get('/timeline', async (req, res) => {
  try {
    // Get page and tag from query params
    const page = req.query.page || 1;
    const tag = req.query.tag || 'All';
    
    // Fetch entries from API
    const entriesResponse = await axios.get(`${API_URL}/api/entries`, {
      params: { page, limit: 10, tag: tag !== 'All' ? tag : undefined }
    });
    
    // Fetch all tags from API
    const tagsResponse = await axios.get(`${API_URL}/api/tags`);
    
    const entries = entriesResponse.data.entries;
    const pagination = entriesResponse.data.pagination;
    const tags = tagsResponse.data;
    
    // Format tags for template
    const filterTags = [{ name: "All", value: "All" }].concat(
      tags.map(tag => ({ name: tag, value: tag }))
    );
    
    // Create pagination data
    const paginationData = {
      prevUrl: pagination.hasPrevPage ? `/timeline?page=${pagination.prevPage}${tag !== 'All' ? `&tag=${tag}` : ''}` : null,
      nextUrl: pagination.hasNextPage ? `/timeline?page=${pagination.nextPage}${tag !== 'All' ? `&tag=${tag}` : ''}` : null,
      pages: []
    };
    
    // Generate page numbers
    for (let i = 1; i <= pagination.totalPages; i++) {
      paginationData.pages.push({
        number: i,
        url: `/timeline?page=${i}${tag !== 'All' ? `&tag=${tag}` : ''}`,
        active: i === parseInt(page)
      });
    }

    res.render('timeline', {
      ...siteConfig,
      timelineTitle: "Timeline | Digital Diary",
      pageTitle: "Timeline",
      navItems: getNavWithActive('/timeline'),
      filterPlaceholder: "Filter timeline...",
      filterButtonText: "Filter",
      filterTags,
      entries,
      readMoreText: "Read More",
      shareButtonText: "Share",
      noEntriesMessage: "No entries found.",
      pagination: paginationData,
      scripts: ["js/tag-filter.js"]
    });
  } catch (err) {
    console.error('Error fetching timeline data from API:', err.message);
    res.status(500).render('error', {
      ...siteConfig,
      navItems: getNavWithActive('/timeline'),
      message: "Error loading timeline",
      error: { status: 500 }
    });
  }
});


router.get('/entry/:id', async (req, res) => {
  try {
    // Fetch entry from API
    const response = await axios.get(`${API_URL}/api/entries/${req.params.id}`);
    const entry = response.data;

    res.render('entry', {
      ...siteConfig,
      navItems: getNavWithActive(null), // No active nav for entries
      entry
    });
  } catch (err) {
    console.error(`Error fetching entry ${req.params.id} from API:`, err.message);
    
    // Handle 404 vs other errors
    const status = err.response && err.response.status === 404 ? 404 : 500;
    const message = status === 404 ? "Entry not found" : "Error loading entry";
    
    res.status(status).render('error', {
      ...siteConfig,
      navItems: getNavWithActive(null),
      message,
      error: { status }
    });
  }
});

// Categories route
router.get('/categories', async (req, res) => {
  try {
    // Fetch categories from API
    const response = await axios.get(`${API_URL}/api/categories`);
    const categories = response.data;
    
    res.render('categories', {
      ...siteConfig,
      navItems: getNavWithActive('/categories'),
      categories
    });
  } catch (err) {
    console.error('Error fetching categories from API:', err.message);
    
    // If the API endpoint doesn't exist yet, show "coming soon"
    if (err.response && err.response.status === 404) {
      return res.render('error', {
        ...siteConfig,
        navItems: getNavWithActive('/categories'),
        message: "Categories page coming soon",
        error: { status: "Under Construction" }
      });
    }
    
    res.status(500).render('error', {
      ...siteConfig,
      navItems: getNavWithActive('/categories'),
      message: "Error loading categories",
      error: { status: 500 }
    });
  }
});

// Tags route
router.get('/tags', async (req, res) => {
  try {
    // Fetch tags from API
    const response = await axios.get(`${API_URL}/api/tags`);
    const tags = response.data;
    
    res.render('tags', {
      ...siteConfig,
      navItems: getNavWithActive('/tags'),
      tags
    });
  } catch (err) {
    console.error('Error fetching tags from API:', err.message);
    
    // If the API endpoint doesn't exist yet, show "coming soon"
    if (err.response && err.response.status === 404) {
      return res.render('error', {
        ...siteConfig,
        navItems: getNavWithActive('/tags'),
        message: "Tags page coming soon",
        error: { status: "Under Construction" }
      });
    }
    
    res.status(500).render('error', {
      ...siteConfig,
      navItems: getNavWithActive('/tags'),
      message: "Error loading tags",
      error: { status: 500 }
    });
  }
});

// About route
router.get('/about', (req, res) => {
  res.render('error', {
    ...siteConfig,
    navItems: getNavWithActive('/about'),
    message: "About page coming soon",
    error: { status: "Under Construction" }
  });
});

// Search route
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q;
    
    if (!query) {
      return res.redirect('/');
    }
    
    // Fetch search results from API
    const response = await axios.get(`${API_URL}/api/search`, {
      params: { q: query }
    });
    
    const results = response.data;
    
    res.render('search-results', {
      ...siteConfig,
      navItems: getNavWithActive(null),
      query,
      results,
      resultsCount: results.length,
      noResultsMessage: "No entries found matching your search."
    });
  } catch (err) {
    console.error('Error searching entries from API:', err.message);
    res.status(500).render('error', {
      ...siteConfig,
      navItems: getNavWithActive(null),
      message: "Error performing search",
      error: { status: 500 }
    });
  }
});

module.exports = router;
