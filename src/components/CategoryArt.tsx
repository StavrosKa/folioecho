import { isCategoryArtwork,type CategoryArtwork } from '../lib/category-groups';
export default function CategoryArt({ name,artwork }: { name: string;artwork?:CategoryArtwork }) {
  const category = artwork??name.trim().toLowerCase();
  return <img className="category-art" src={`/category-art/${isCategoryArtwork(category) ? category : 'default'}.svg`} alt="" aria-hidden="true" width="96" height="96" loading="lazy" draggable={false} />;
}
