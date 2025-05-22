var express = require('express');
var router = express.Router();
var axios = require('axios');

// Fix API URL - remove REACT_APP_ prefix for Node.js
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

// Helper function to format entries with consistent tag structure
const formatEntries = (entries, tagAsString = false) => {
  return entries.map(entry => {
    // Format the date
    const formattedDate = new Date(entry.date).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    // Format tags consistently
    let formattedTags = (entry.tags || []).map(tag => {
      if (typeof tag === 'object' && tag.name) {
        return tagAsString ? tag.name : { name: tag.name };
      }
      return tagAsString ? tag : { name: tag };
    });

    return {
      ...entry,
      date: formattedDate,
      tags: formattedTags
    };
  });
};

/* GET home page. */
router.get('/', async function (req, res, next) {
  try {
    const response = await axios.get(`${API_URL}/api/entries?limit=3`);
    const entries = response.data;

    // Format entries with tags as objects (homepage.pug expects tag.name)
    const formattedEntries = formatEntries(entries, false);
    
    res.render('homepage', {
      ...siteConfig,
      navItems: getNavWithActive('/'),
      welcomeHeader: "Welcome to My Digital Diary",
      welcomeMessage: "This is my personal digital space where I share my thoughts, experiences, and memories.",
      searchPlaceholder: "Search my diary...",
      searchButtonText: "Search",
      entriesHeader: "Recent Entries",
      entries: formattedEntries,
      readMoreText: "Read More",
      noEntriesMessage: "No entries found.",
      scripts: ["js/tag-filter.js"]
    });
  } catch (err) {
    console.error('Error fetching entries from API:', err.message);
    console.error('Full error:', err.response?.data || err);
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
    
    // Try to fetch tags, but don't fail if endpoint doesn't exist
    let tags = [];
    try {
      const tagsResponse = await axios.get(`${API_URL}/api/tags`);
      tags = tagsResponse.data;
    } catch (tagError) {
      console.log('Tags endpoint not available, using fallback tags');
      // Extract unique tags from entries as fallback
      const rawEntries = entriesResponse.data.entries || entriesResponse.data;
      const allTags = rawEntries.flatMap(entry => entry.tags || []);
      tags = [...new Set(allTags.map(tag => typeof tag === 'object' ? tag.name : tag))];
    }
    
    const rawEntries = entriesResponse.data.entries || entriesResponse.data;
    
    // Format entries with tags as objects (timeline.pug expects tag.name)
    const entries = formatEntries(rawEntries, false);
    
    const pagination = entriesResponse.data.pagination;
    
    // Format tags for template
    const filterTags = [{ name: "All", value: "All" }].concat(
      tags.map(tag => ({ name: tag, value: tag }))
    );
    
    // Create pagination data
    let paginationData = null;
    if (pagination) {
      paginationData = {
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
    console.error('Full error:', err.response?.data || err);
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

    // Format entry with tags as strings (entry.pug expects string tags)
    const [formattedEntry] = formatEntries([entry], true);

    res.render('entry', {
      ...siteConfig,
      navItems: getNavWithActive(null), // No active nav for entries
      entry: formattedEntry
    });
  } catch (err) {
    console.error(`Error fetching entry ${req.params.id} from API:`, err.message);
    console.error('Full error:', err.response?.data || err);
    
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
    // Try to fetch tags from API
    let tags = [];
    try {
      const response = await axios.get(`${API_URL}/api/tags`);
      tags = response.data;
    } catch (apiError) {
      // If tags endpoint doesn't exist, extract from entries
      console.log('Tags endpoint not available, extracting from entries');
      const entriesResponse = await axios.get(`${API_URL}/api/entries`);
      const entries = entriesResponse.data.entries || entriesResponse.data;
      const allTags = entries.flatMap(entry => entry.tags || []);
      tags = [...new Set(allTags.map(tag => typeof tag === 'object' ? tag.name : tag))];
    }
    
    res.render('tags', {
      ...siteConfig,
      navItems: getNavWithActive('/tags'),
      tags
    });
  } catch (err) {
    console.error('Error fetching tags:', err.message);
    
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
    
    // Format results with tags as strings (search-results.pug expects string tags)
    const formattedResults = formatEntries(results, true);
    
    res.render('search-results', {
      ...siteConfig,
      navItems: getNavWithActive(null),
      query,
      results: formattedResults,
      resultsCount: formattedResults.length,
      noResultsMessage: "No entries found matching your search."
    });
  } catch (err) {
    console.error('Error searching entries from API:', err.message);
    console.error('Full error:', err.response?.data || err);
    res.status(500).render('error', {
      ...siteConfig,
      navItems: getNavWithActive(null),
      message: "Error performing search",
      error: { status: 500 }
    });
  }
});

module.exports = router;