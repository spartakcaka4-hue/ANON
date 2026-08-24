import { Search } from 'lucide-react';
import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { normalizeQuery } from '../utils/validation';

export function SearchBox() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const routeQuery = params.get('q') ?? '';
  const [value, setValue] = useState(routeQuery);

  useEffect(() => setValue(routeQuery), [routeQuery]);

  function navigateToSearch() {
    const query = normalizeQuery(value);
    const type = location.pathname === '/search' && params.get('type') === 'channels' ? '&type=channels' : '';
    if (query) navigate(`/search?q=${encodeURIComponent(query)}${type}`);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    navigateToSearch();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      navigateToSearch();
    }
  }

  return (
    <form className="search-box" onSubmit={submit} role="search">
      <Search aria-hidden="true" size={22} />
      <input
        aria-label="Search YouTube"
        autoComplete="off"
        maxLength={120}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Search YouTube without an ANON account"
        value={value}
      />
      <button type="submit">Search</button>
    </form>
  );
}
