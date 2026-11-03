import { useEffect, useMemo, useState } from 'react';

import ParallaxScrollView from '@/components/ParallaxScrollView';
import { RecordCard, RecordList } from '@/components/RecordList';
import ScreenHeader from '@/components/ScreenHeader';
import TileContainer from '@/components/TileContainer';
import { ThemedButton } from '@/components/ThemedButton';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import { useTransaction } from '@/context/TransactionContext';
import { generateBank } from '@/helpers/factories';
import { useThemeColor } from '@/hooks/useThemeColor';
import useAccountsBack from '@/hooks/useAccountsBack';
import useTrackHistory from '@/hooks/useTrackHistory';
import { Bank as BankType } from '@/types';
import BankAccount from '@/views/BankAccount';

export default function BanksScreen() {
	useTrackHistory('/(authenticated)/banks');
	// Reached from the Accounts hub, so the header steps back to it.
	useAccountsBack();
	const { banks, fetchBanks, setBanks } = useTransaction();
	const { user, language } = useGeneral();

	const bg = useThemeColor({}, 'background');
	const actionButton = useThemeColor({}, 'actionButton');
	const authButtonText = useThemeColor({}, 'authButtonText');
	const copy = translations[language]?.categories?.banks ?? translations.en.categories.banks;

	const [page] = useState(1);
	const pageSize = 50;

	const paged = useMemo(() => {
		const start = (page - 1) * pageSize;
		return banks.slice(start, start + pageSize);
	}, [banks, page]);


	useEffect(() => {
		if (user && banks.length === 0) {
			fetchBanks().catch(() => {});
		}
	}, [user, banks.length, fetchBanks]);

	const [showAdd, setShowAdd] = useState(false);
	const [showEdit, setShowEdit] = useState(false);
	const [showView, setShowView] = useState(false);
	const [editBank, setEditBank] = useState<BankType | null>(null);

	const handleAddAccount = () => setShowAdd(true);
	const handleCancelAdd = () => setShowAdd(false);
	const handleSaveAdd = ({
		name,
		accountNumber,
		phone,
		swift,
	}: {
		name: string;
		accountNumber: string;
		phone: string;
		swift: string;
	}) => {
		const newBank = generateBank({
			name,
			accountNumber,
			SWIFTCode: swift,
			currency: 'UGX',
			accountHolderName: phone,
		});
		setBanks((prev) => [newBank, ...prev]);
		setShowAdd(false);
	};

	const handleView = (id: string) => {
		const found = banks.find((b) => b.id === id) ?? null;
		setEditBank(found);
		setShowView(!!found);
	};

	const handleEdit = (id: string) => {
		const found = banks.find((b) => b.id === id) ?? null;
		setEditBank(found);
		setShowEdit(!!found);
	};

	const handleDelete = (id: string) => console.log('Delete bank', id);

	const handleUpdateBank = ({
		name,
		accountNumber,
		phone,
		swift,
	}: {
		name: string;
		accountNumber: string;
		phone: string;
		swift: string;
	}) => {
		if (!editBank) return;
		setBanks((prev) =>
			prev.map((b) =>
				b.id === editBank.id
					? {
							...b,
							name,
							accountNumber,
							accountHolderName: phone,
							SWIFTCode: swift,
					  }
					: b
			)
		);
		setShowEdit(false);
		setEditBank(null);
	};

	return (
		<ParallaxScrollView
			headerBackgroundColor={{ light: bg, dark: bg }}
			containerStyle={{ flex: 1 }}
			contentStyle={{ paddingHorizontal: 10 }}
		>
						<TileContainer
				id='banks-header-tile'
				flat
				backgroundColor={bg}
				style={{ width: '100%', marginBottom: 12 }}
			>
				<ScreenHeader
					id='banks-header'
					title={copy.title}
					action={
						<ThemedButton
							title={copy.addAccount}
							icon='plus'
							numberOfLines={1}
							onPress={handleAddAccount}
							style={{ borderRadius: 8 }}
							darkColor={actionButton}
							lightColor={actionButton}
							darkTextColor={authButtonText}
							lightTextColor={authButtonText}
						/>
					}
				/>
			</TileContainer>

			<TileContainer
				id='banks-list-tile'
				flat
				backgroundColor={bg}
				style={{ flexDirection: 'column' }}
			>
				<RecordList
					id='banks-list'
					isEmpty={banks.length === 0}
					emptyMessage={copy.noBanks}
				>
					{paged.map((b) => (
						<RecordCard
							key={b.id}
							id={`bank-${b.id}`}
							title={b.name}
							subtitle={b.accountHolderName}
							fields={[
								{ label: copy.accountNumber, value: b.accountNumber },
								{ label: copy.swiftCode, value: b.SWIFTCode },
							]}
							actions={[
								{
									label: translations[language].categories.packages.view,
									icon: 'eye.outline',
									tone: 'primary',
									onPress: () => handleView(b.id),
								},
								{
									label: translations[language].categories.packages.edit,
									icon: 'edit.outline',
									tone: 'warning',
									onPress: () => handleEdit(b.id),
								},
								{
									label: translations[language].categories.packages.delete,
									icon: 'delete.outline',
									tone: 'danger',
									onPress: () => handleDelete(b.id),
								},
							]}
						/>
					))}
				</RecordList>
			</TileContainer>

			<BankAccount
				visible={showAdd}
				onCancel={handleCancelAdd}
				onSave={handleSaveAdd}
			/>
			<BankAccount
				visible={showEdit}
				mode='edit'
				initial={{
					name: editBank?.name ?? '',
					accountNumber: editBank?.accountNumber ?? '',
					phone: editBank?.accountHolderName ?? '',
					swift: editBank?.SWIFTCode ?? '',
				}}
				onCancel={() => {
					setShowEdit(false);
					setEditBank(null);
				}}
				onSave={handleUpdateBank}
			/>
			<BankAccount
				visible={showView}
				mode='view'
				initial={{
					name: editBank?.name ?? '',
					accountNumber: editBank?.accountNumber ?? '',
					phone: editBank?.accountHolderName ?? '',
					swift: editBank?.SWIFTCode ?? '',
				}}
				onBack={() => {
					setShowView(false);
					setEditBank(null);
				}}
				onEdit={() => {
					setShowView(false);
					setShowEdit(true);
				}}
				onCancel={() => {
					setShowView(false);
					setEditBank(null);
				}}
				onSave={() => {
					/* no-op in view mode */
				}}
			/>
		</ParallaxScrollView>
	);
}
