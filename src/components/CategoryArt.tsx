const illustrated = new Set(['cities', 'memory', 'travel', 'creativity', 'identity', 'imagination', 'introspection', 'nature', 'art', 'family', 'friendship', 'music', 'mystery', 'solitude']);
export default function CategoryArt({ name }: { name: string }) {
  const category = name.trim().toLowerCase();
  return <img className="category-art" src={`/category-art/${illustrated.has(category) ? category : 'default'}.svg`} alt="" aria-hidden="true" width="96" height="96" loading="lazy" draggable={false} />;
}
