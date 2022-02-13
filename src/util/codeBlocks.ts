import { Message, TextChannel } from 'discord.js';
import { decompressFromEncodedURIComponent } from 'lz-string';
import { getReferencedMessage } from './getReferencedMessage';

const CODEBLOCK_REGEX = /```(?:ts|typescript)?\n([\s\S]+)```/;

export const PLAYGROUND_REGEX = /https?:\/\/(?:www\.)?(?:typescriptlang|staging-typescript)\.org\/(?:play|dev\/bug-workbench)(?:\/index\.html)?\/?(\??(?:\w+=[^\s#&]*)?(?:\&\w+=[^\s#&]*)*)#code\/([\w\-%+_]+={0,4})/;

export async function findCode(message: Message, ignoreLinks = false) {
	const codeInMessage = findCodeInMessage(message, ignoreLinks);
	if (codeInMessage) return codeInMessage;
	const referencedMessage = await getReferencedMessage(message);
	if (referencedMessage) {
		const codeInReferencedMessage = findCodeInMessage(
			referencedMessage,
			ignoreLinks,
		);
		if (codeInReferencedMessage) return codeInReferencedMessage;
	}
	const msgs = await message.channel.messages.fetch({ limit: 10 });

	for (const msg of msgs.values()) {
		const code = findCodeInMessage(msg, ignoreLinks);
		if (code) return code;
	}
}

// Two possibilities:
// 1: Normal code block annotated with ts from a non-bot
// 2: Link to TS playground. This can be either from a bot or a normal user
//    since we shorten playground links on their own and delete the message.
function findCodeInMessage(
	{ author, content, embeds }: Message,
	ignoreLinks = false,
) {
	if (!author.bot) {
		const match = content.match(CODEBLOCK_REGEX);
		if (match && match[1].length) {
			return match[1];
		}
	}

	if (ignoreLinks) return;

	const match = content.match(PLAYGROUND_REGEX);
	if (match) {
		return decompressFromEncodedURIComponent(match[2]);
	}

	for (const embed of embeds) {
		const match = embed.url?.match(PLAYGROUND_REGEX);
		if (match) {
			return decompressFromEncodedURIComponent(match[2]);
		}
	}
}

const CODEBLOCK = '```';
// 2048 is the most characters Discord allows in a message/embed
const MAX_CODE_LENGTH = 2048 - `${CODEBLOCK}ts\n${CODEBLOCK}`.length;

export function makeCodeBlock(code: string) {
	return `${CODEBLOCK}ts\n${truncate(
		escapeCode(code),
		MAX_CODE_LENGTH,
	)}${CODEBLOCK}`;
}

// Note: If str.length === cutoff, the string fits! No need to truncate.
// (This is an easy off-by-one error to make)
export function truncate(str: string, max: number) {
	return str.length <= max ? str : str.slice(0, max - 1) + '…';
}

// Custom escape function instead of using discord.js Util.escapeCodeBlock because this
// produces better results with template literal types. Discord's markdown handling is pretty
// bad. It doesn't properly handle escaping back ticks, so we instead insert zero width spaces
// so that users cannot escape our code block.
function escapeCode(code: string) {
	return code.replace(/`(?=`)/g, '`\u200B');
}
