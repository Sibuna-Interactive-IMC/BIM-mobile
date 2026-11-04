import ListPagination from '@/components/ListPagination';
import Prompt from '@/components/Prompt';
import { RecordCard, RecordList } from '@/components/RecordList';
import type { RecordField } from '@/components/RecordList';
import { ThemedButton } from '@/components/ThemedButton';
import ThemedDatePicker from '@/components/ThemedDatePicker';
import { ThemedDropdown } from '@/components/ThemedDropdown';
import { ThemedInput } from '@/components/ThemedInput';
import { ThemedRadioButtons } from '@/components/ThemedRadioButtons';
import { ThemedText } from '@/components/ThemedText';
import TileContainer from '@/components/TileContainer';
import { Colors } from '@/constants/Colors';
import { fontSize, fontWeight } from '@/constants/Font';
import translations from '@/constants/Trans';
import { useGeneral } from '@/context/GeneralContext';
import {
	formatDateTime,
	ShowAlert,
	toApiDate,
	translateWithVariables,
} from '@/helpers';
import { getApiMessage } from '@/helpers/apiResponse';
import { useThemeColor } from '@/hooks/useThemeColor';
import { previewRecipients, queueBroadcast } from '@/services/BroadcastService';
import type {
	BroadcastAudience,
	BroadcastAudienceFilters,
	BroadcastLimits,
	BroadcastRecipientPreview,
	BroadcastSite,
	BroadcastTemplate,
	PreviewRecipientsResponse,
	PromptButton,
} from '@/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	StyleSheet,
	useAnimatedValue,
	useColorScheme,
	View,
} from 'react-native';

type PurchasesOperator = 'lt' | 'gt' | 'eq';

/**
 * The composer: pick an audience, load the numbers the filters resolve to, write
 * the message and queue it.
 *
 * The audience is resolved on the SERVER. The list this panel shows is that
 * resolution; unchecking a row only records the number in `excluded`, which the
 * send posts back so the server subtracts the same people.
 */
export default function BroadcastComposePanel({
	authToken,
	sites,
	templates,
	limits,
	onQueued,
}: {
	authToken?: string;
	sites: BroadcastSite[];
	templates: BroadcastTemplate[];
	limits?: BroadcastLimits | null;
	onQueued: () => void;
}) {
	const { language } = useGeneral();
	const t = translations[language].categories.broadcast;
	const buttons = translations[language].categories.buttons;
	const loadingCopy = translations[language].categories.dashboard.loading;
	const colorScheme = useColorScheme();

	const background = useThemeColor({}, 'background');
	const bim = useThemeColor({}, 'bim');
	const white = useThemeColor({}, 'white');
	const mutedText = useThemeColor({}, 'screenTitleText');
	const cancelButton = useThemeColor({}, 'cancelButton');

	const [audience, setAudience] = useState<BroadcastAudience>('site');
	const [siteLabel, setSiteLabel] = useState('');
	const [phone, setPhone] = useState('');
	const [dateFrom, setDateFrom] = useState<Date | null>(null);
	const [dateTo, setDateTo] = useState<Date | null>(null);
	const [operatorLabel, setOperatorLabel] = useState('');
	const [purchasesCount, setPurchasesCount] = useState('');
	const [message, setMessage] = useState('');
	const [templateLabel, setTemplateLabel] = useState('');
	const [openDropdown, setOpenDropdown] = useState<string | null>(null);
	const siteRef = useRef<View>(null);
	const operatorRef = useRef<View>(null);
	const templateRef = useRef<View>(null);

	const [recipients, setRecipients] = useState<BroadcastRecipientPreview[]>([]);
	const [recipientTotal, setRecipientTotal] = useState<number | null>(null);
	const [excluded, setExcluded] = useState<string[]>([]);
	const [page, setPage] = useState(1);
	const [lastPage, setLastPage] = useState(1);
	const [previewing, setPreviewing] = useState(false);
	const [queueing, setQueueing] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);
	const confirmFade = useAnimatedValue(0);

	const maxRecipients = limits?.max_recipients ?? 2000;
	const maxMessage = limits?.max_message_length ?? 640;

	const audienceOptions = useMemo(
		() => [
			{ key: 'all', label: t.audienceAll, description: t.audienceAllHint },
			{ key: 'site', label: t.audienceSite, description: t.audienceSiteHint },
			{ key: 'single', label: t.audienceSingle, description: t.audienceSingleHint },
		],
		[t.audienceAll, t.audienceAllHint, t.audienceSingle, t.audienceSingleHint, t.audienceSite, t.audienceSiteHint]
	);

	const operatorOptions = useMemo(
		() => [t.anyNumber, t.lessThan, t.moreThan, t.exactly],
		[t.anyNumber, t.exactly, t.lessThan, t.moreThan]
	);

	const templateOptions = useMemo(
		() => [t.noTemplate, ...templates.map((template) => template.name)],
		[t.noTemplate, templates]
	);

	const siteOptions = useMemo(
		() => sites.map((site) => site.label),
		[sites]
	);

	const routerId =
		sites.find((site) => site.label === siteLabel)?.id ?? '';

	const operatorValue: PurchasesOperator | null =
		operatorLabel === t.lessThan
			? 'lt'
			: operatorLabel === t.moreThan
				? 'gt'
				: operatorLabel === t.exactly
					? 'eq'
					: null;

	const selectedTemplate =
		templates.find((template) => template.name === templateLabel) ?? null;

	const segments = useMemo(() => {
		const length = message.trim().length;
		if (length === 0) return 0;
		const single = limits?.sms_segment_length ?? 160;
		const multi = limits?.sms_multipart_segment_length ?? 153;
		return length <= single ? 1 : Math.ceil(length / multi);
	}, [
		limits?.sms_multipart_segment_length,
		limits?.sms_segment_length,
		message,
	]);

	const selectedCount = Math.max(0, (recipientTotal ?? 0) - excluded.length);
	const overLimit = selectedCount > maxRecipients;

	/** The audience half of the request; `excluded` is only for the send. */
	const filters = useCallback(
		(includeExcluded: boolean): BroadcastAudienceFilters => ({
			audience,
			...(audience === 'site' ? { router_id: routerId } : {}),
			...(audience === 'single' ? { phone: phone.trim() } : {}),
			...(audience !== 'single'
				? {
						date_from: toApiDate(dateFrom),
						date_to: toApiDate(dateTo),
						purchases_operator: operatorValue,
						purchases_count:
							operatorValue && purchasesCount
								? Number(purchasesCount)
								: null,
					}
				: {}),
			...(includeExcluded && excluded.length ? { excluded } : {}),
		}),
		[
			audience,
			dateFrom,
			dateTo,
			excluded,
			operatorValue,
			phone,
			purchasesCount,
			routerId,
		]
	);

	// The web composer preselects the first site, so "Reload recipients" has an
	// audience to resolve without an extra tap.
	useEffect(() => {
		if (!siteLabel && sites.length) setSiteLabel(sites[0].label);
	}, [siteLabel, sites]);

	// Any change to who is in the audience invalidates the previewed list, so the
	// admin always approves a list that matches the filters on screen.
	useEffect(() => {
		setRecipients([]);
		setRecipientTotal(null);
		setExcluded([]);
		setPage(1);
		setLastPage(1);
	}, [audience, routerId, phone, dateFrom, dateTo, operatorValue, purchasesCount]);

	const loadRecipients = useCallback(
		async (nextPage = 1) => {
			if (!authToken) return;
			if (audience === 'site' && !routerId) {
				ShowAlert(t.chooseSite, 'Error');
				return;
			}
			if (audience === 'single' && !phone.trim()) {
				ShowAlert(t.phoneRequired, 'Error');
				return;
			}
			if (dateFrom && dateTo && dateTo < dateFrom) {
				ShowAlert(t.dateRangeInvalid, 'Error');
				return;
			}

			setPreviewing(true);
			try {
				const res = await previewRecipients(
					{ ...filters(false), message },
					authToken
				);
				const body: PreviewRecipientsResponse = await res.json().catch(() => null);
				if (!res.ok) {
					ShowAlert(getApiMessage(body) || t.loadFailed, 'Error');
					setRecipients([]);
					setRecipientTotal(null);
					return;
				}
				const payload = body?.data ?? body;
				setRecipients(payload?.recipients ?? []);
				setRecipientTotal(payload?.summary?.total ?? 0);
				setPage(
					payload?.recipients_metadata?.current_page ??
						nextPage
				);
				setLastPage(Math.max(1, payload?.recipients_metadata?.last_page ?? 1));
				setExcluded([]);
			} catch (e) {
				console.error('[BroadcastComposePanel] preview failed', e);
				ShowAlert(t.loadFailed, 'Error');
			} finally {
				setPreviewing(false);
			}
		},
		[
			audience,
			authToken,
			dateFrom,
			dateTo,
			filters,
			message,
			phone,
			routerId,
			t.chooseSite,
			t.dateRangeInvalid,
			t.loadFailed,
			t.phoneRequired,
		]
	);

	const toggleRecipient = useCallback((recipientPhone: string) => {
		setExcluded((current) =>
			current.includes(recipientPhone)
				? current.filter((entry) => entry !== recipientPhone)
				: [...current, recipientPhone]
		);
	}, []);

	const excludePage = useCallback(() => {
		setExcluded((current) => {
			const next = new Set(current);
			recipients.forEach((recipient) => next.add(recipient.phone));
			return Array.from(next);
		});
	}, [recipients]);

	const includePage = useCallback(() => {
		const pagePhones = new Set(recipients.map((recipient) => recipient.phone));
		setExcluded((current) => current.filter((entry) => !pagePhones.has(entry)));
	}, [recipients]);

	const closeConfirm = useCallback(() => {
		confirmFade.setValue(0);
		setShowConfirm(false);
	}, [confirmFade]);

	const queue = useCallback(async () => {
		if (!authToken) return;
		if (!message.trim()) {
			ShowAlert(t.messageRequired, 'Error');
			return;
		}
		if (recipientTotal === null) {
			ShowAlert(t.previewFirst, 'Error');
			return;
		}
		if (selectedCount === 0) {
			ShowAlert(t.loadFailed, 'Error');
			return;
		}

		closeConfirm();
		setQueueing(true);
		try {
			const payload = {
				...filters(true),
				message: message.trim(),
				recipients_total: selectedCount,
				template_id:
					selectedTemplate && selectedTemplate.body.trim() === message.trim()
						? selectedTemplate.id
						: null,
			};
			const res = await queueBroadcast(payload, authToken);
			const body = await res.json().catch(() => null);
			if (!res.ok) {
				ShowAlert(getApiMessage(body) || t.queueFailed, 'Error');
				return;
			}
			ShowAlert(getApiMessage(body) || t.queued, 'Success');
			setMessage('');
			setTemplateLabel('');
			setRecipients([]);
			setRecipientTotal(null);
			setExcluded([]);
			onQueued();
		} catch (e) {
			console.error('[BroadcastComposePanel] queue failed', e);
			ShowAlert(t.queueFailed, 'Error');
		} finally {
			setQueueing(false);
		}
	}, [
		authToken,
		closeConfirm,
		filters,
		message,
		onQueued,
		recipientTotal,
		selectedCount,
		selectedTemplate,
		t.loadFailed,
		t.messageRequired,
		t.previewFirst,
		t.queueFailed,
		t.queued,
	]);

	const requestQueue = useCallback(() => {
		if (!message.trim()) {
			ShowAlert(t.messageRequired, 'Error');
			return;
		}
		if (recipientTotal === null) {
			ShowAlert(t.previewFirst, 'Error');
			return;
		}
		confirmFade.setValue(1);
		setShowConfirm(true);
	}, [confirmFade, message, recipientTotal, t.messageRequired, t.previewFirst]);

	const recipientFields = (
		recipient: BroadcastRecipientPreview
	): RecordField[] => [
		{
			label: t.purchasesCountField,
			value: String(recipient.purchases ?? 0),
			tone: 'info',
		},
		{ label: t.lastPurchase, value: formatDateTime(recipient.last_purchase_at) },
		{
			label: t.sitesField,
			value: (recipient.sites ?? []).join(', ') || '—',
			fullWidth: true,
		},
	];

	const confirmButtons: PromptButton[] = [
		{
			title: buttons.cancel,
			color: cancelButton,
			textColor: white,
			action: closeConfirm,
		},
		{
			title: t.confirm,
			color: bim,
			textColor: white,
			action: () => {
				void queue();
			},
		},
	];

	return (
		<View style={styles.panel}>
			<RecordList
				id='broadcast-audience'
				title={t.audience}
				isEmpty={false}
				// A dropdown menu is absolutely positioned inside this section, so the
				// whole section has to paint above the ones below it while it is open.
				style={
					openDropdown === 'site' || openDropdown === 'operator'
						? styles.raised
						: undefined
				}
			>
				<ThemedRadioButtons
					id='broadcast-audience-choice'
					options={audienceOptions}
					value={audience}
					onChange={(key) => setAudience(key as BroadcastAudience)}
				/>

				{audience === 'site' ? (
					sites.length ? (
						<ThemedDropdown
							id='broadcast-site'
							containerRef={siteRef}
							label={t.site}
							placeholder={t.chooseSite}
							options={siteOptions}
							value={siteLabel || t.chooseSite}
							setValue={(value) =>
								setSiteLabel(value === t.chooseSite ? '' : String(value))
							}
							showDropdown={openDropdown === 'site'}
							setShowDropdown={(open) => setOpenDropdown(open ? 'site' : null)}
							openDirection='down'
						/>
					) : (
						<ThemedText
							style={[styles.hint, { color: mutedText }]}
							lightColor={mutedText}
							darkColor={mutedText}
						>
							{t.noSites}
						</ThemedText>
					)
				) : null}

				{audience === 'single' ? (
					<>
						<ThemedInput
							label={t.phone}
							placeholder='0772 494 949'
							keyboardType='phone-pad'
							maxLength={32}
							value={phone}
							setValue={setPhone}
						/>
						<ThemedText
							style={[styles.hint, { color: mutedText }]}
							lightColor={mutedText}
							darkColor={mutedText}
						>
							{t.phoneHint}
						</ThemedText>
					</>
				) : null}

				{audience !== 'single' ? (
					<>
						<View style={styles.dateRow}>
							<View style={styles.dateField}>
								<ThemedDatePicker
									label={t.boughtFrom}
									placeholder={t.boughtFrom}
									value={dateFrom}
									onChange={setDateFrom}
								/>
							</View>
							<View style={styles.dateField}>
								<ThemedDatePicker
									label={t.boughtTo}
									placeholder={t.boughtTo}
									value={dateTo}
									onChange={setDateTo}
								/>
							</View>
						</View>
						<ThemedText
							style={[styles.hint, { color: mutedText }]}
							lightColor={mutedText}
							darkColor={mutedText}
						>
							{t.dateRangeHint}
						</ThemedText>

						<ThemedDropdown
							id='broadcast-purchases-operator'
							containerRef={operatorRef}
							label={t.purchases}
							placeholder={t.anyNumber}
							options={operatorOptions}
							value={operatorLabel || t.anyNumber}
							setValue={(value) => {
								const next = value === t.anyNumber ? '' : String(value);
								setOperatorLabel(next);
								if (!next) setPurchasesCount('');
							}}
							showDropdown={openDropdown === 'operator'}
							setShowDropdown={(open) =>
								setOpenDropdown(open ? 'operator' : null)
							}
							openDirection='down'
						/>

						{operatorValue ? (
							<ThemedInput
								label={t.purchasesCount}
								placeholder={t.purchasesCount}
								keyboardType='number-pad'
								value={purchasesCount}
								setValue={setPurchasesCount}
							/>
						) : null}

						<ThemedText
							style={[styles.hint, { color: mutedText }]}
							lightColor={mutedText}
							darkColor={mutedText}
						>
							{t.purchasesHint}
						</ThemedText>
					</>
				) : null}

				<View style={styles.actions}>
					<ThemedButton
						title={t.reloadRecipients}
						icon='refresh'
						onPress={() => {
							void loadRecipients(1);
						}}
						loading={previewing}
						disabled={previewing}
						numberOfLines={1}
						style={styles.actionButton}
						lightColor={bim}
						darkColor={bim}
						lightTextColor={white}
						darkTextColor={white}
						iconColor={white}
						textStyle={styles.actionText}
					/>
				</View>

				{recipientTotal !== null ? (
					<View style={styles.summary}>
						<View style={styles.summaryRow}>
							<ThemedText
								style={[styles.summaryLabel, { color: mutedText }]}
								lightColor={mutedText}
								darkColor={mutedText}
							>
								{t.selected}
							</ThemedText>
							<ThemedText style={styles.summaryValue}>{selectedCount}</ThemedText>
						</View>
						<View style={styles.summaryRow}>
							<ThemedText
								style={[styles.summaryLabel, { color: mutedText }]}
								lightColor={mutedText}
								darkColor={mutedText}
							>
								{t.inAudience}
							</ThemedText>
							<ThemedText style={styles.summaryValue}>{recipientTotal}</ThemedText>
						</View>
						<View style={styles.summaryRow}>
							<ThemedText
								style={[styles.summaryLabel, { color: mutedText }]}
								lightColor={mutedText}
								darkColor={mutedText}
							>
								{t.unchecked}
							</ThemedText>
							<ThemedText style={styles.summaryValue}>{excluded.length}</ThemedText>
						</View>
					</View>
				) : null}

				{overLimit ? (
					<ThemedText
						style={[styles.hint, { color: Colors[colorScheme ?? 'light'].error }]}
						lightColor={Colors[colorScheme ?? 'light'].error}
						darkColor={Colors[colorScheme ?? 'light'].error}
					>
						{translateWithVariables(t.overLimit, {
							count: selectedCount,
							max: maxRecipients,
						})}
					</ThemedText>
				) : (
					<ThemedText
						style={[styles.hint, { color: mutedText }]}
						lightColor={mutedText}
						darkColor={mutedText}
					>
						{translateWithVariables(t.limitHint, { max: maxRecipients })}
					</ThemedText>
				)}
			</RecordList>

			{recipientTotal !== null ? (
				<TileContainer
					id='broadcast-recipients'
					borderless
					backgroundColor={background}
					style={styles.section}
				>
					<RecordList
						id='broadcast-recipients-list'
						title={t.recipients}
						loading={previewing && recipients.length === 0}
						loadingMessage={loadingCopy}
						isEmpty={!previewing && recipients.length === 0}
						emptyMessage={t.loadFailed}
						headerAction={
							<View style={styles.pageActions}>
								<ThemedButton
									title={t.selectAll}
									icon='check'
									onPress={includePage}
									numberOfLines={1}
									lightColor='transparent'
									darkColor='transparent'
									lightTextColor={bim}
									darkTextColor={bim}
									textStyle={styles.actionText}
								/>
								<ThemedButton
									title={t.unselectPage}
									icon='close'
									onPress={excludePage}
									numberOfLines={1}
									lightColor='transparent'
									darkColor='transparent'
									lightTextColor={bim}
									darkTextColor={bim}
									textStyle={styles.actionText}
								/>
							</View>
						}
					>
						{recipients.map((recipient) => {
							const isExcluded = excluded.includes(recipient.phone);
							return (
								<RecordCard
									key={recipient.phone}
									id={`broadcast-recipient-${recipient.phone}`}
									title={recipient.display_phone || recipient.phone}
									badge={
										isExcluded
											? { label: t.excludedBadge, tone: 'muted' }
											: { label: t.selected, tone: 'success' }
									}
									fields={recipientFields(recipient)}
									actions={[
										{
											label: isExcluded ? t.include : t.exclude,
											icon: isExcluded ? 'checkboxMarked' : 'checkboxBlank',
											tone: isExcluded ? 'success' : 'neutral',
											onPress: () => toggleRecipient(recipient.phone),
										},
									]}
								/>
							);
						})}

						{lastPage > 1 ? (
							<ListPagination
								id='broadcast-recipients-pagination'
								page={page}
								lastPage={lastPage}
								onPrev={() => {
									void loadRecipients(Math.max(1, page - 1));
								}}
								onNext={() => {
									void loadRecipients(Math.min(lastPage, page + 1));
								}}
							/>
						) : null}
					</RecordList>
				</TileContainer>
			) : null}

			{templates.length ? (
				<RecordList
					id='broadcast-template-picker'
					title={t.template}
					description={t.templateHint}
					isEmpty={false}
					style={openDropdown === 'template' ? styles.raised : undefined}
				>
					<ThemedDropdown
						id='broadcast-template'
						containerRef={templateRef}
						placeholder={t.noTemplate}
						options={templateOptions}
						value={templateLabel || t.noTemplate}
						setValue={(value) => {
							const label = value === t.noTemplate ? '' : String(value);
							setTemplateLabel(label);
							const template = templates.find((entry) => entry.name === label);
							if (template) setMessage(template.body);
						}}
						showDropdown={openDropdown === 'template'}
						setShowDropdown={(open) => setOpenDropdown(open ? 'template' : null)}
						openDirection='down'
					/>
				</RecordList>
			) : null}

			<RecordList id='broadcast-message' title={t.message} isEmpty={false}>
				<ThemedInput
					placeholder={t.messagePlaceholder}
					lines={7}
					multiline
					maxLength={maxMessage}
					value={message}
					setValue={setMessage}
				/>

				<View style={styles.summaryRow}>
					<ThemedText
						style={[styles.hint, { color: mutedText }]}
						lightColor={mutedText}
						darkColor={mutedText}
					>
						{translateWithVariables(t.characters, {
							count: message.length,
							max: maxMessage,
						})}
					</ThemedText>
					<ThemedText
						style={[styles.hint, { color: mutedText }]}
						lightColor={mutedText}
						darkColor={mutedText}
					>
						{translateWithVariables(t.parts, { count: segments })}
					</ThemedText>
				</View>

				<ThemedText
					style={[styles.hint, { color: mutedText }]}
					lightColor={mutedText}
					darkColor={mutedText}
				>
					{t.senderHint}
				</ThemedText>

				<View style={styles.actions}>
					<ThemedButton
						title={t.queue}
						icon='paperplane.fill'
						onPress={requestQueue}
						loading={queueing}
						disabled={queueing || overLimit}
						numberOfLines={1}
						style={styles.actionButton}
						lightColor={bim}
						darkColor={bim}
						lightTextColor={white}
						darkTextColor={white}
						iconColor={white}
						textStyle={styles.actionText}
					/>
				</View>
			</RecordList>

			<Prompt
				id='broadcast-queue-prompt'
				fadeAnim={confirmFade}
				visible={showConfirm}
				onClose={closeConfirm}
				title={audience === 'all' ? t.queueAllTitle : t.queueTitle}
				message={
					audience === 'all'
						? t.queueAllMessage
						: translateWithVariables(t.queueMessage, { count: selectedCount })
				}
				buttons={confirmButtons}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	panel: {
		width: '100%',
		gap: 12,
	},
	/** Lifts the section owning the open dropdown above the sections below it. */
	raised: {
		zIndex: 20,
		elevation: 20,
	},
	section: {
		width: '100%',
		gap: 10,
	},
	dateRow: {
		flexDirection: 'row',
		gap: 10,
	},
	dateField: {
		flex: 1,
		minWidth: 0,
	},
	actions: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
		alignItems: 'center',
		gap: 10,
	},
	pageActions: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
	},
	actionButton: {
		flex: 1,
		minWidth: 0,
	},
	actionText: {
		fontSize: fontSize['button.small'],
		fontWeight: fontWeight['button.small'],
	},
	summary: {
		width: '100%',
		gap: 4,
	},
	summaryRow: {
		width: '100%',
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 8,
	},
	summaryLabel: {
		fontSize: fontSize['text.xsmall'],
	},
	summaryValue: {
		fontSize: fontSize['text.medium'],
		fontWeight: fontWeight['button.small'],
	},
	hint: {
		fontSize: fontSize['text.xsmall'],
		lineHeight: 16,
	},
});
