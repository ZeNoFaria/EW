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
// Helper function to format entries with consistent tag structure
const formatEntries = (entries, tagAsString = false) => {
  return entries.map(entry => {
    // Format the date
    const formattedDate = new Date(entry.date).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });

    // Format tags consistently - handle populated vs unpopulated refs
    let formattedTags = (entry.tags || []).map(tag => {
      // If tag is populated object with name
      if (typeof tag === 'object' && tag.name) {
        return tagAsString ? tag.name : { name: tag.name };
      }
      // If tag is just a string (already processed)
      if (typeof tag === 'string') {
        return tagAsString ? tag : { name: tag };
      }
      // If tag is ObjectId string, use it as name (fallback)
      const tagName = tag.toString();
      return tagAsString ? tagName : { name: tagName };
    });

    // Handle category - might be populated or just ObjectId
    let categoryName = null;
    if (entry.category) {
      if (typeof entry.category === 'object' && entry.category.name) {
        categoryName = entry.category.name;
      } else if (typeof entry.category === 'string') {
        categoryName = entry.category;
      }
    }

    // Use MongoDB's _id and convert to string for URLs
    const entryId = entry._id ? entry._id.toString() : entry.id;

    return {
      ...entry,
      id: entryId, // Convert ObjectId to string for URLs
      date: formattedDate,
      tags: formattedTags,
      category: categoryName,
      // Keep original fields
      _id: entry._id,
      originalCategory: entry.category
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

    // Extract all unique tag names
    const tagSet = new Set();
    formattedEntries.forEach(entry => {
      (entry.tags || []).forEach(tag => {
        if (tag?.name) tagSet.add(tag.name);
      });
    });
    const allTags = Array.from(tagSet).map(name => ({ name }));
    
    res.render('homepage', {
      ...siteConfig,
      navItems: getNavWithActive('/'),
      welcomeHeader: "Welcome to My Digital Diary",
      welcomeMessage: "This is my personal digital space where I share my thoughts, experiences, and memories.",
      searchPlaceholder: "Search my diary...",
      searchButtonText: "Search",
      entriesHeader: "Recent Entries",
      entries: formattedEntries,
      allTags,
      readMoreText: "Read More",
      noEntriesMessage: "No entries found.",
      scripts: ["javascripts/tag-filter.js", "javascripts/search.js"]
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
    
    let rawEntries = [];
    let tags = [];
    let paginationData = null;
    
    try {
      // Try the specific timeline endpoint first
      console.log(`Fetching from: ${API_URL}/api/entries/timeline`);
      const entriesResponse = await axios.get(`${API_URL}/api/entries/timeline`, {
        params: { page, limit: 10, tag: tag !== 'All' ? tag : undefined }
      });
      rawEntries = entriesResponse.data;
      
      // Check if response has pagination info
      if (entriesResponse.data.pagination) {
        paginationData = entriesResponse.data.pagination;
        rawEntries = entriesResponse.data.entries || entriesResponse.data.data || [];
      }
    } catch (timelineError) {
      console.log('Timeline endpoint failed, trying general entries endpoint');
      try {
        // Fallback to general entries endpoint
        const entriesResponse = await axios.get(`${API_URL}/api/entries`, {
          params: { page, limit: 10, tag: tag !== 'All' ? tag : undefined }
        });
        
        // Handle different response structures
        if (entriesResponse.data.entries) {
          rawEntries = entriesResponse.data.entries;
          paginationData = entriesResponse.data.pagination;
        } else if (Array.isArray(entriesResponse.data)) {
          rawEntries = entriesResponse.data;
        } else {
          rawEntries = entriesResponse.data.data || [];
        }
      } catch (generalError) {
        console.error('Both timeline and general entries endpoints failed');
        throw generalError;
      }
    }
    
    // Try to fetch tags
    try {
      const tagsResponse = await axios.get(`${API_URL}/api/tags`);
      tags = tagsResponse.data;
    } catch (tagError) {
      console.log('Tags endpoint not available, extracting from entries');
      // Extract unique tags from entries as fallback
      const allTags = rawEntries.flatMap(entry => entry.tags || []);
      const uniqueTags = [...new Set(allTags.map(tag => typeof tag === 'object' ? tag.name : tag))];
      tags = uniqueTags.filter(tag => tag && tag.trim()); // Remove empty/whitespace tags
    }
    
    // Format entries with tags as objects (timeline.pug expects tag.name)
    const formattedEntries = formatEntries(rawEntries, false);
    
    // Format tags for template
    const filterTags = [{ name: "All", value: "All" }].concat(
      tags.map(tag => ({ name: tag, value: tag }))
    );
    
    // Create pagination data if it exists
    let finalPaginationData = null;
    if (paginationData) {
      finalPaginationData = {
        prevUrl: paginationData.hasPrevPage ? `/timeline?page=${paginationData.prevPage}${tag !== 'All' ? `&tag=${tag}` : ''}` : null,
        nextUrl: paginationData.hasNextPage ? `/timeline?page=${paginationData.nextPage}${tag !== 'All' ? `&tag=${tag}` : ''}` : null,
        pages: []
      };
      
      // Generate page numbers
      for (let i = 1; i <= paginationData.totalPages; i++) {
        finalPaginationData.pages.push({
          number: i,
          url: `/timeline?page=${i}${tag !== 'All' ? `&tag=${tag}` : ''}`,
          active: i === parseInt(page)
        });
      }
    }

    // Debug logging
    console.log('Timeline render data:', {
      entriesCount: formattedEntries.length,
      tagsCount: tags.length,
      hasPagination: !!finalPaginationData,
      firstEntry: formattedEntries[0] ? formattedEntries[0].title : 'none'
    });

    res.render('timeline', {
      ...siteConfig,
      timelineTitle: "Timeline | Digital Diary",
      pageTitle: "Timeline",
      navItems: getNavWithActive('/timeline'),
      filterPlaceholder: "Filter timeline...",
      filterButtonText: "Filter",
      filterTags,
      entries: formattedEntries,
      readMoreText: "Read More",
      shareButtonText: "Share",
      noEntriesMessage: "No entries found.",
      pagination: finalPaginationData,
      scripts: ["javascripts/tag-filter.js"]
    });
  } catch (err) {
    console.error('Error fetching timeline data from API:', err.message);
    console.error('API_URL:', API_URL);
    console.error('Full error:', err.response?.data || err);
    
    // Render with empty data instead of showing error page
    res.render('timeline', {
      ...siteConfig,
      timelineTitle: "Timeline | Digital Diary",
      pageTitle: "Timeline",
      navItems: getNavWithActive('/timeline'),
      filterPlaceholder: "Filter timeline...",
      filterButtonText: "Filter",
      filterTags: [{ name: "All", value: "All" }],
      entries: [], // Empty entries will show "No entries found"
      readMoreText: "Read More",
      shareButtonText: "Share",
      noEntriesMessage: "Unable to load entries. Please check your API connection.",
      pagination: null,
      scripts: ["javascripts/tag-filter.js"]
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

    // Try to fetch related entries (optional)
    let relatedEntries = [];
    try {
      if (formattedEntry.tags && formattedEntry.tags.length > 0) {
        // Get entries with similar tags
        const relatedResponse = await axios.get(`${API_URL}/api/entries`, {
          params: { 
            tags: formattedEntry.tags.slice(0, 2).join(','), // Use first 2 tags
            limit: 3,
            exclude: req.params.id // Don't include current entry
          }
        });
        
        const rawRelated = Array.isArray(relatedResponse.data) 
          ? relatedResponse.data 
          : relatedResponse.data.entries || [];
        
        relatedEntries = formatEntries(rawRelated.slice(0, 3), true); // Limit to 3
      }
    } catch (relatedError) {
      console.log('Could not fetch related entries:', relatedError.message);
      // Continue without related entries
    }

    // Add related entries to the formatted entry
    formattedEntry.relatedEntries = relatedEntries;

    // Set page title
    const pageTitle = `${formattedEntry.title} | ${siteConfig.siteName}`;

    console.log('Entry render data:', {
      id: formattedEntry.id,
      title: formattedEntry.title,
      hasContent: !!formattedEntry.content,
      tagsCount: formattedEntry.tags?.length || 0,
      relatedCount: relatedEntries.length
    });

    res.render('entry', {
      ...siteConfig,
      title: pageTitle,
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
    const response = await axios.get(`${API_URL}/api/categories`);
    const categories = response.data;

    // Stats
    const totalItems = categories.reduce((sum, cat) => sum + (cat.count || 0), 0);
    const activeCategories = categories.length;
    const publicItems = totalItems;
    const lastItemDate = categories.reduce((latest, cat) => {
      if (cat.lastUpdate && (!latest || new Date(cat.lastUpdate) > new Date(latest))) {
        return cat.lastUpdate;
      }
      return latest;
    }, null);

    res.render('categories', {
      ...siteConfig,
      navItems: getNavWithActive('/categories'),
      title: "Categorias - Meu Diário Digital",
      categories,
      totalItems,
      activeCategories,
      publicItems,
      lastItemDate,
      user: req.user || null
    });

  } catch (err) {
    console.error('Error loading /categories page:', err);
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

// Categories route - Enhanced version
router.get('/categories', async (req, res) => {
  try {
    let categories = [];
    let totalItems = 0;
    let tags = [];
    
    // Try to fetch categories from API
    try {
      const response = await axios.get(`${API_URL}/api/categories`);
      categories = response.data;
    } catch (apiError) {
      console.log('Categories endpoint not available, building from entries');
      
      // Fallback: Build categories from entries
      try {
        const entriesResponse = await axios.get(`${API_URL}/api/entries`);
        const entries = Array.isArray(entriesResponse.data) ? entriesResponse.data : entriesResponse.data.entries || [];
        
        // Group entries by category
        const categoryMap = new Map();
        
        entries.forEach(entry => {
          const categoryName = entry.category?.name || entry.category || 'Uncategorized';
          const categorySlug = categoryName.toLowerCase().replace(/[^a-z0-9]/g, '-');
          
          if (!categoryMap.has(categoryName)) {
            categoryMap.set(categoryName, {
              name: categoryName,
              slug: categorySlug,
              count: 0,
              recentItems: [],
              lastUpdate: null,
              description: `Items in ${categoryName}`,
              icon: 'fas fa-folder'
            });
          }
          
          const category = categoryMap.get(categoryName);
          category.count++;
          
          // Add to recent items (keep last 5)
          const formattedDate = new Date(entry.date).toLocaleDateString('pt-BR');
          category.recentItems.push({
            id: entry._id?.toString() || entry.id,
            title: entry.title,
            date: formattedDate
          });
          
          // Update last update date
          const entryDate = new Date(entry.date);
          if (!category.lastUpdate || entryDate > new Date(category.lastUpdate)) {
            category.lastUpdate = formattedDate;
          }
        });
        
        categories = Array.from(categoryMap.values())
          .map(cat => ({
            ...cat,
            recentItems: cat.recentItems.slice(-5).reverse() // Keep 5 most recent
          }))
          .sort((a, b) => b.count - a.count); // Sort by count descending
        
        totalItems = entries.length;
      } catch (entriesError) {
        console.error('Could not fetch entries for categories:', entriesError.message);
      }
    }
    
    // Try to fetch tags
    try {
      const tagsResponse = await axios.get(`${API_URL}/api/tags`);
      tags = tagsResponse.data;
    } catch (tagError) {
      console.log('Tags endpoint not available, extracting from entries');
      try {
        const entriesResponse = await axios.get(`${API_URL}/api/entries`);
        const entries = Array.isArray(entriesResponse.data) ? entriesResponse.data : entriesResponse.data.entries || [];
        
        // Extract and count tags
        const tagMap = new Map();
        entries.forEach(entry => {
          (entry.tags || []).forEach(tag => {
            const tagName = typeof tag === 'object' ? tag.name : tag;
            if (tagName && tagName.trim()) {
              tagMap.set(tagName, (tagMap.get(tagName) || 0) + 1);
            }
          });
        });
        
        tags = Array.from(tagMap.entries()).map(([name, count]) => ({
          name,
          slug: name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          count,
          size: Math.min(5, Math.max(1, Math.ceil(count / Math.max(1, tagMap.size / 5))))
        })).sort((a, b) => b.count - a.count);
      } catch (entriesError) {
        console.error('Could not extract tags from entries:', entriesError.message);
      }
    }
    
    // Calculate stats
    const activeCategories = categories.length;
    const publicItems = totalItems; // Assuming all are public for now
    const lastItemDate = categories.length > 0 
      ? categories.reduce((latest, cat) => 
          !latest || (cat.lastUpdate && new Date(cat.lastUpdate) > new Date(latest)) 
            ? cat.lastUpdate : latest, null)
      : 'N/A';
    
    console.log('Categories render data:', {
      categoriesCount: categories.length,
      totalItems,
      activeCategories,
      tagsCount: tags.length
    });
    
    res.render('categories', {
      ...siteConfig,
      title: "Categorias - Meu Diário Digital",
      navItems: getNavWithActive('/categories'),
      categories,
      tags,
      totalItems,
      activeCategories,
      publicItems,
      lastItemDate,
      // Add user context (you may need to adapt this based on your auth system)
      user: req.user || null
    });
    
  } catch (err) {
    console.error('Error in categories route:', err.message);
    console.error('Full error:', err.response?.data || err);
    
    res.status(500).render('error', {
      ...siteConfig,
      navItems: getNavWithActive('/categories'),
      message: "Error loading categories",
      error: { status: 500 }
    });
  }
});

// Category detail page
router.get('/category/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    
    // Fetch entries for this category
    const response = await axios.get(`${API_URL}/api/entries`, {
      params: { category: slug, limit: 50 }
    });
    
    const entries = Array.isArray(response.data) ? response.data : response.data.entries || [];
    const formattedEntries = formatEntries(entries, false);
    
    // Find category name from entries or use slug
    const categoryName = entries.length > 0 && entries[0].category?.name 
      ? entries[0].category.name 
      : slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    
    res.render('timeline', { // Reuse timeline template
      ...siteConfig,
      title: `${categoryName} - Categorias`,
      pageTitle: `Categoria: ${categoryName}`,
      navItems: getNavWithActive('/categories'),
      filterPlaceholder: "Filter entries...",
      filterButtonText: "Filter",
      filterTags: [{ name: "All", value: "All" }],
      entries: formattedEntries,
      readMoreText: "Read More",
      shareButtonText: "Share",
      noEntriesMessage: `No entries found in category "${categoryName}".`,
      pagination: null,
      scripts: ["javascripts/tag-filter.js"]
    });
    
  } catch (err) {
    console.error(`Error fetching category ${req.params.slug}:`, err.message);
    res.status(500).render('error', {
      ...siteConfig,
      navItems: getNavWithActive('/categories'),
      message: "Error loading category",
      error: { status: 500 }
    });
  }
});

// Tag detail page
router.get('/tag/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    const tagName = slug.replace(/-/g, ' ');
    
    // Fetch entries for this tag
    const response = await axios.get(`${API_URL}/api/entries`, {
      params: { tag: tagName, limit: 50 }
    });
    
    const entries = Array.isArray(response.data) ? response.data : response.data.entries || [];
    const formattedEntries = formatEntries(entries, false);
    
    res.render('timeline', { // Reuse timeline template
      ...siteConfig,
      title: `${tagName} - Tags`,
      pageTitle: `Tag: ${tagName}`,
      navItems: getNavWithActive('/tags'),
      filterPlaceholder: "Filter entries...",
      filterButtonText: "Filter",
      filterTags: [{ name: "All", value: "All" }],
      entries: formattedEntries,
      readMoreText: "Read More",
      shareButtonText: "Share",
      noEntriesMessage: `No entries found with tag "${tagName}".`,
      pagination: null,
      scripts: ["javascripts/tag-filter.js"]
    });
    
  } catch (err) {
    console.error(`Error fetching tag ${req.params.slug}:`, err.message);
    res.status(500).render('error', {
      ...siteConfig,
      navItems: getNavWithActive('/tags'),
      message: "Error loading tag",
      error: { status: 500 }
    });
  }
});



// Item detail page (alternative route for the Portuguese template)
router.get('/item/:id', (req, res) => {
  // Redirect to the existing entry route
  res.redirect(`/entry/${req.params.id}`);
});

module.exports = router;