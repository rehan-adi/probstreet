import type { PanInfo } from 'framer-motion';
import { useModalStore } from '@/store/modal';
import { useTranslation } from 'react-i18next';
import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';

import step1Img from '/Users/rehan/.gemini/antigravity-ide/brain/64d9de6f-311e-4d53-bf9f-e80a0bf021d7/how_it_works_step_1_1785429192027.png';
import step2Img from '/Users/rehan/.gemini/antigravity-ide/brain/64d9de6f-311e-4d53-bf9f-e80a0bf021d7/how_it_works_step_2_1785429215160.png';
import step3Img from '/Users/rehan/.gemini/antigravity-ide/brain/64d9de6f-311e-4d53-bf9f-e80a0bf021d7/how_it_works_step_3_1785429237781.png';

export default function HowItWorksModal({ onClose }: { onClose: () => void }) {
	const { t } = useTranslation();
	const { openOnboardModal } = useModalStore();
	const [currentStep, setCurrentStep] = useState(0);
	const dragControls = useDragControls();
	const [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		const checkMobile = () => setIsMobile(window.innerWidth < 768);
		checkMobile();
		window.addEventListener('resize', checkMobile);
		return () => window.removeEventListener('resize', checkMobile);
	}, []);

	const STEPS = useMemo(
		() => [
			{
				title: t('step1_title'),
				desc: t('step1_desc'),
				image: step1Img,
			},
			{
				title: t('step2_title'),
				desc: t('step2_desc'),
				image: step2Img,
			},
			{
				title: t('step3_title'),
				desc: t('step3_desc'),
				image: step3Img,
			},
		],
		[t],
	);

	const handleNext = () => {
		if (currentStep < STEPS.length - 1) {
			setCurrentStep((prev) => prev + 1);
		} else {
			onClose();
			openOnboardModal();
		}
	};

	const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
		if (info.offset.y > 100 || info.velocity.y > 500) {
			onClose();
		}
	};

	const modalVariants: any = isMobile
		? {
				hidden: { y: '100%' },
				visible: { y: 0, transition: { type: 'spring', damping: 25, stiffness: 300 } },
				exit: { y: '100%', transition: { type: 'spring', damping: 25, stiffness: 300 } },
			}
		: {
				hidden: { opacity: 0, scale: 0.95 },
				visible: { opacity: 1, scale: 1, transition: { duration: 0.2, ease: 'easeOut' } },
				exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15, ease: 'easeIn' } },
			};

	return (
		<div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center sm:p-4">
			{/* Backdrop with fade animation */}
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				onClick={onClose}
				className="absolute inset-0 bg-black/60 backdrop-blur-sm"
			/>

			<motion.div
				variants={modalVariants}
				initial="hidden"
				animate="visible"
				exit="exit"
				drag={isMobile ? 'y' : false}
				dragControls={dragControls}
				dragListener={false}
				dragConstraints={{ top: 0 }}
				dragElastic={0.2}
				onDragEnd={handleDragEnd}
				onClick={(e) => e.stopPropagation()}
				className="relative w-full max-w-md bg-white dark:bg-[#1C1C1E] md:rounded-[24px] rounded-t-[24px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] z-10"
			>
				{isMobile && (
					<div
						className="w-full flex justify-center py-4 cursor-grab active:cursor-grabbing z-20 touch-none shrink-0 bg-white dark:bg-[#1C1C1E] rounded-t-[24px]"
						onPointerDown={(e) => dragControls.start(e)}
					>
						<div className="w-12 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
					</div>
				)}

				<div className="relative h-[320px] w-full bg-gray-100 dark:bg-slate-800 overflow-hidden pointer-events-none select-none">
					<AnimatePresence mode="wait">
						<motion.img
							key={currentStep}
							src={STEPS[currentStep].image}
							alt={STEPS[currentStep].title}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.15 }}
							className="absolute inset-0 w-full h-full object-cover"
						/>
					</AnimatePresence>

					<div className="absolute inset-0 bg-gradient-to-t from-white dark:from-slate-900 via-transparent to-transparent" />
				</div>

				<div className="p-6 md:p-8 flex flex-col items-start text-left bg-white dark:bg-[#1C1C1E] z-10 relative">
					<div className="min-h-[110px] w-full relative">
						<AnimatePresence mode="wait">
							<motion.div
								key={currentStep}
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.15 }}
								className="absolute inset-0"
							>
								<h2 className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white mb-2">
									{STEPS[currentStep].title}
								</h2>
								<p className="text-gray-600 dark:text-slate-400 leading-relaxed text-[13px] sm:text-sm">
									{STEPS[currentStep].desc}
								</p>
							</motion.div>
						</AnimatePresence>
					</div>

					<button
						onClick={handleNext}
						className="mt-2 w-full py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-md font-medium text-sm flex items-center justify-center cursor-pointer transition-colors"
					>
						{currentStep === STEPS.length - 1 ? t('btn_get_started') : t('btn_next')}
					</button>
				</div>
			</motion.div>
		</div>
	);
}
