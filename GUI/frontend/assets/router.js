const cache = new Map();

async function loadFragment(name) {
  console.log('Loading fragment:', name);
  if (cache.has(name)) {
    console.log('Fragment found in cache');
    return cache.get(name);
  }
  const res = await fetch(`/fragments/${name}.html?v=${Date.now()}`);
  if (!res.ok) throw new Error(`Fragment not found: ${name}`);
  const html = await res.text();
  cache.set(name, html);
  console.log('Fragment loaded successfully');
  return html;
}

export function createRouter({ viewEl, setActive }) {
  if (!viewEl) throw new Error('viewEl is required');
  
  let currentRoute = null;

  async function navigate(route) {
    console.log('Navigating to:', route);

    try {
      // Unmount current route if exists
      if (currentRoute?.unmount) {
        console.log('Unmounting current route');
        currentRoute.unmount();
      }

      // Load and render new fragment
      const html = await loadFragment(route.fragment);
      viewEl.innerHTML = html;
      console.log('HTML set to viewEl');

      // Mount new route
      if (route.mount) {
        console.log('Mounting new route:', route.name);
        currentRoute = route;
        await route.mount(viewEl);
      } else {
        console.warn('No mount function for route:', route.name);
        currentRoute = null;
      }

      // Update active state
      if (setActive) {
        console.log('Setting active state for:', route.name);
        setActive(route.name);
      }
    } catch (error) {
      console.error('Navigation error:', error);
    }
  }

  return {
    start(routesMap) {
      if (!routesMap) {
        throw new Error('Routes map is required');
      }

      console.log('Starting router with routes:', Object.keys(routesMap));

      const go = () => {
        const hash = location.hash || '#/sessions';
        const name = hash.replace('#/', '') || 'sessions';
        console.log('Hash changed to:', name);

        const route = routesMap[name] || routesMap.sessions;
        navigate(route).catch(console.error);
      };

      window.addEventListener('hashchange', go);
      console.log('Initial navigation');
      go();
    }
  };
}
