import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { ThemedButton } from '@/components/ThemedButton';
import { ThemedInput } from '@/components/ThemedInput';
import { ThemedSwitch } from '@/components/ThemedSwitch';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import TileContainer from '@/components/TileContainer';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { translateWithVariables } from '@/helpers';
import { useThemeColor } from '@/hooks/useThemeColor';
import { PortalPackage } from '@/types';

type Props = {
	pkg: PortalPackage;
	saving?: boolean;
	onSave: (payload: {
		visible: string[];
		rate_limits: Record<string, string | null>;
		reconnect_users: boolean;
	}) => void | Promise<void>;
};

export default function PackageRoutersCard({ pkg, saving, onSave }: Props) {
	const bg = useThemeColor({}, 'background');
	const textColor = useThemeColor({}, 'text');
	const mutedText = useThemeColor({}, 'mutedText');
	const border = useThemeColor({}, 'borderDark');
	const staleColor = useThemeColor({}, 'yellow');
	const buttonBg = useThemeColor({}, 'bim');
	const buttonText = useThemeColor({}, 'authButtonText');
	const { language } = useGeneral();

	const packagesCopy = translations[language]?.categories?.packages ?? translations.en.categories.packages;
	const t = (key: string) =>
		packagesCopy[key] ?? translations.en.categories.packages[key] ?? '';

	const [visible, setVisible] = useState<Record<string, boolean>>({});
	const [limits, setLimits] = useState<Record<string, string>>({});
	const [reconnect, setReconnect] = useState(true);

	useEffect(() => {
		const nextVisible: Record<string, boolean> = {};
		const nextLimits: Record<string, string> = {};
		for (const router of pkg.routers ?? []) {
			nextVisible[router.id] = router.visible;
			nextLimits[router.id] = router.rate_limit ?? '';
		}
		setVisible(nextVisible);
		setLimits(nextLimits);
		setReconnect(true);
	}, [pkg.id, pkg.routers]);

	const save = () => {
		const rate_limits: Record<string, string | null> = {};
		for (const router of pkg.routers ?? []) {
			if (router.rate_limit_editable === false) continue;
			const value = (limits[router.id] ?? '').trim();
			rate_limits[router.id] = value ? value : null;
		}
		void onSave({
			visible: (pkg.routers ?? [])
				.filter((router) => visible[router.id])
				.map((router) => router.id),
			rate_limits,
			reconnect_users: reconnect,
		});
	};

	return (
		<TileContainer
			id={`package-routers-${pkg.id}`}
			backgroundColor={bg}
			style={styles.card}
		>
			<ThemedView
				style={styles.header}
				lightColor='transparent'
				darkColor='transparent'
			>
				<ThemedView
					style={{ flex: 1, gap: 2 }}
					lightColor='transparent'
					darkColor='transparent'
				>
					<ThemedText
						style={styles.title}
						lightColor={textColor}
						darkColor={textColor}
					>
						{pkg.label}
					</ThemedText>
					<ThemedText
						style={styles.meta}
						lightColor={mutedText}
						darkColor={mutedText}
					>
						{translateWithVariables(t('routersPlanLine'), {
							group: pkg.profile?.group ?? pkg.rad_group,
							rate: pkg.profile?.rate_limit ?? t('open'),
							owner:
								pkg.owner?.name ??
								(pkg.is_global ? t('platform') : t('you')),
						})}
					</ThemedText>
				</ThemedView>
				<ThemedText
					style={styles.badge}
					lightColor={mutedText}
					darkColor={mutedText}
				>
					{pkg.is_global ? t('globalPackage') : t('ownerPackage')}
				</ThemedText>
			</ThemedView>

			<ThemedText
				style={styles.help}
				lightColor={mutedText}
				darkColor={mutedText}
			>
				{t('routersCardHelp')}
			</ThemedText>

			{(pkg.routers ?? []).length === 0 ? (
				<ThemedText
					lightColor={mutedText}
					darkColor={mutedText}
					style={{ paddingVertical: 12 }}
				>
					{t('noPackageRouters')}
				</ThemedText>
			) : (
				(pkg.routers ?? []).map((router, index) => (
					<ThemedView
						key={router.id}
						style={[
							styles.routerRow,
							{
								borderBottomWidth:
									index < pkg.routers.length - 1 ? 1 : 0,
								borderBottomColor: border,
							},
						]}
						lightColor='transparent'
						darkColor='transparent'
					>
						<ThemedView
							style={styles.routerHeader}
							lightColor='transparent'
							darkColor='transparent'
						>
							<ThemedText
								style={styles.routerName}
								lightColor={textColor}
								darkColor={textColor}
							>
								{router.name}
							</ThemedText>
							<ThemedSwitch
								value={!!visible[router.id]}
								onValueChange={(value) =>
									setVisible((prev) => ({
										...prev,
										[router.id]: value,
									}))
								}
							/>
						</ThemedView>
						{router.heartbeat_state === 'stale' ? (
							<ThemedText
								style={styles.stale}
								lightColor={staleColor}
								darkColor={staleColor}
							>
								{t('stale')}
							</ThemedText>
						) : null}
						<ThemedInput
							label={t('rateLimit')}
							placeholder={translateWithVariables(t('inheritRate'), {
								rate: pkg.profile?.rate_limit ?? t('open'),
							})}
							value={limits[router.id] ?? ''}
							setValue={(value) =>
								setLimits((prev) => ({ ...prev, [router.id]: value }))
							}
							editable={router.rate_limit_editable !== false}
							style={{ borderColor: border }}
						/>
						<ThemedText
							style={styles.effective}
							lightColor={mutedText}
							darkColor={mutedText}
						>
							{translateWithVariables(t('effectiveLine'), {
								source:
									router.rate_limit_source === 'override'
										? t('sourceOverride')
										: t('sourcePlan'),
								rate: router.effective_rate_limit ?? t('open'),
							})}
						</ThemedText>
					</ThemedView>
				))
			)}

			<ThemedView
				style={styles.reconnectRow}
				lightColor='transparent'
				darkColor='transparent'
			>
				<ThemedText
					style={styles.reconnectText}
					lightColor={textColor}
					darkColor={textColor}
				>
					{t('reconnectVouchers')}
				</ThemedText>
				<ThemedSwitch value={reconnect} thumbColor={'white'} onValueChange={setReconnect} />
			</ThemedView>

			<ThemedButton
				title={t('saveRouterSettings')}
				onPress={save}
				loading={saving}
				icon='package'
				lightColor={buttonBg}
				darkColor={buttonBg}
				lightTextColor={buttonText}
				darkTextColor={buttonText}
			/>
		</TileContainer>
	);
}

const styles = StyleSheet.create({
	card: {
		width: '100%',
		gap: 10,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		gap: 8,
	},
	title: {
		fontSize: fontSize['heading.two'],
		fontWeight: fontWeight['heading.two'],
	},
	meta: {
		fontSize: 13,
	},
	badge: {
		fontSize: 11,
		textTransform: 'uppercase',
	},
	help: {
		fontSize: 13,
	},
	routerRow: {
		width: '100%',
		gap: 6,
		paddingVertical: 10,
	},
	routerHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 8,
	},
	routerName: {
		flex: 1,
		fontSize: fontSize['text.large'],
		fontWeight: fontWeight['heading.three'],
	},
	stale: {
		fontSize: 11,
		textTransform: 'uppercase',
	},
	effective: {
		fontSize: 12,
	},
	reconnectRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		paddingTop: 6,
	},
	reconnectText: {
		flex: 1,
		fontSize: 13,
	},
});
