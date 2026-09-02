import { useEffect, useState } from 'react';
import { getAllCategoary } from '@/api/category';
import { useSearchParams } from 'react-router-dom';

interface Category {
	id: string;
	categoryName: string;
}

export default function CategoryNav() {
	const [categories, setCategories] = useState<Category[]>([]);
	const [searchParams, setSearchParams] = useSearchParams();
	const selectedCategoryName = searchParams.get('category') || 'All Events';

	useEffect(() => {
		const fetchCategories = async () => {
			try {
				const response = await getAllCategoary();
				setCategories([{ id: 'all', categoryName: 'All Events' }, ...response.data.data]);
			} catch (err) {
				console.error('Error fetching categories:', err);
			}
		};

		fetchCategories();
	}, []);

	const handleCategoryChange = (name: string) => {
		if (name === 'All Events') {
			setSearchParams({});
		} else {
			setSearchParams({ category: name });
		}
	};

	return (
		<div className="w-full dark:bg-[#090C1A] border-b border-gray-100 dark:border-gray-800 transition-colors">
			<div className="w-full px-6">
				<div className="max-w-7xl mx-auto h-12 flex items-center gap-8 overflow-x-auto scrollbar-hide">
					{categories.map((cat) => (
						<button
							key={cat.id}
							onClick={() => handleCategoryChange(cat.categoryName)}
							className={`relative h-full flex items-center md:text-[15px] text-sm whitespace-nowrap transition-colors duration-300 cursor-pointer ${
								selectedCategoryName === cat.categoryName
									? 'text-black dark:text-white font-semibold'
									: 'text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white'
							}`}
						>
							{cat.categoryName}
							{selectedCategoryName === cat.categoryName && (
								<span className="absolute left-0 right-0 bottom-0 h-0.5 bg-black dark:bg-white transition-colors" />
							)}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
