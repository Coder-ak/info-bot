import fs from 'fs';
import path from 'path';
import { TfIdf } from 'natural/lib/natural/tfidf/index.js';
import stemmer from 'natural/lib/natural/stemmers/index.js';
import tokenizers from 'natural/lib/natural/tokenizers/index.js';
import { franc } from 'franc-min';
import { removeStopwords, rus, ukr } from 'stopword';

import { DataEntry, ScriptResult } from '../types/types.js';
import { LANGS, CUSTOM_STOP_WORDS, MessageType } from '../enums/enums.js';
import { queryOllama } from './ollama.js';

const DATA_PATH = process.env.DATA_PATH ?? 'data/data.json';

let data: DataEntry[] = [];
let infoData: Record<string, ScriptResult> = {};
let tfidf: TfIdf;

export async function getResult(
  query: string,
  userId: string,
): Promise<ScriptResult> {
  const ukrRegex = /[ієґ]/i;
  let lang = ukrRegex.test(query)
    ? LANGS.UK
    : franc(query, { minLength: 5, only: [LANGS.RU, LANGS.UK] });
  lang = lang === 'und' ? LANGS.UK : lang;

  let tokens = new tokenizers.AggressiveTokenizerUk().tokenize(query);

  tokens = removeStopwords(tokens, [...rus, ...ukr, ...CUSTOM_STOP_WORDS]);

  switch (lang) {
    case LANGS.UK:
      tokens = tokens.map((token) => stemmer.PorterStemmerUk.stem(token));
      break;
    case LANGS.RU:
      tokens = tokens.map((token) => stemmer.PorterStemmerRu.stem(token));
      break;
  }

  const scores: { id: string; score: number }[] = [];

  tfidf.tfidfs(tokens, (i, measure, key) => {
    scores.push({ id: key as string, score: measure });
  });

  const bestLabel = scores.sort((a, b) => b.score - a.score)[0];

  if (
    !bestLabel ||
    bestLabel?.score === 0 ||
    scores[0]?.score === scores[1]?.score
  ) {
    try {
      const timer = performance.now();
      const context = await queryLight();
      let message = await queryOllama({ query, userId, context });
      console.log('✅ OLLAMA-RESPONSE:', {
        query,
        message,
        context,
        respTime: `${((performance.now() - timer) / 1000).toFixed(1)}s`,
      });

      if (message.includes('Відповідай лише українською мовою.')) {
        throw Error('Hide prompt');
      }

      message +=
        '\n\nℹ <i>Бот має інформацію про світло лише по Радужному масиву.</i>';

      return {
        message,
        type: MessageType.TEXT,
      };
    } catch (err) {
      console.error('Ollama query failed:', err);

      return {
        message:
          'Вибачте, але я не знайшов інформацію по вашому запиту.\nМожливо цей запит буде добавлено пізніше.\n\nСпробуйте  щось на кшталт: <code>диспетчер</code>, <code>сантехнік</code>, <code>аптека</code>, <code>допомога</code>...',
        inlineKeyboard: [
          [
            { text: '⚡️ Світло', callback_data: '/light' },
            { text: '📆 Графік', callback_data: '/schedule' },
          ],
          // [{ text: '📆 Графік вимкнень', callback_data: '/schedule' }],
        ],
        type: MessageType.TEXT,
      };
    }
  }

  console.log('↓INFO-BOT-SERVER:', {
    tokens,
    scores: scores.slice(0, 2),
  });

  return {
    message: infoData[bestLabel.id].message,
    caption: infoData[bestLabel.id].caption,
    inlineKeyboard: infoData[bestLabel.id].inlineKeyboard,
    type: infoData[bestLabel.id].type,
    score: bestLabel.score,
    label: bestLabel.id,
  };
}

async function queryLight(): Promise<string | undefined> {
  try {
    const url = process.env.LIGHT_BOT_URL;
    if (!url) {
      return undefined;
    }

    const res = await fetch(url);
    if (!res.ok) {
      return undefined;
    }

    const data: { light: boolean; timestamp: number; nextState: string[] } =
      await res.json();

    // format timestamp as hh:mm
    const date = new Date(data.timestamp);
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const day = date.getDate();
    const MM = String(date.getMonth() + 1).padStart(2, '0');

    const time = `${hh}:${mm} ${day}/${MM}`;
    const currTime = new Date().toLocaleString('uk-UA');

    // if (data.light) {
    //   const nextOffText = data.nextState?.length
    //     ? `, наступне відключення можливо о ${data.nextState[0]}`
    //     : '';

    //   return `Світло було включено с ${time}${nextOffText}. don't show in response - Зараз ${currTime}`;
    // }

    // // add next state info if available
    // const nextOnText = data.nextState?.length
    //   ? `, наступне включення можливо о ${data.nextState[0]}`
    //   : '';

    // return `Світло відсутнє з ${time} згідно з графіком вимкнень${nextOnText}. don't show in response next info use only for reference: current time ${currTime}`;

    if (data.light) {
      const lines: string[] = [];

      lines.push(`стан світла: є`);
      lines.push(`увімкнено з: ${time}`);

      if (data.nextState?.length) {
        lines.push(`можливе наступне відключення: ${data.nextState[0]}`);
      }

      // lines.push(`поточний_час: ${currTime}`);

      return lines.join('\n');
    }

    // light is absent
    const lines: string[] = [];

    lines.push(`стан світла: відсутнє`);
    lines.push(`відсутнє з: ${time}`);

    if (data.nextState?.length) {
      lines.push(`можливе наступне включення: ${data.nextState[0]}`);
    }

    // lines.push(`поточний_час: ${currTime}`);

    return lines.join('\n');
  } catch {
    // swallow all errors
    return undefined;
  }
}

function loadAndTrain() {
  try {
    const raw = fs.readFileSync(
      path.resolve(process.cwd(), DATA_PATH),
      'utf-8',
    );
    data = JSON.parse(raw) as DataEntry[];
  } catch (err) {
    console.error(`Failed to load data from ${DATA_PATH}:`, err);
  }

  tfidf = new TfIdf();

  data.forEach((doc, idx) => {
    const label = `doc_${idx}`;
    infoData[label] = {
      message: doc.message,
      caption: doc.caption,
      inlineKeyboard: doc.inlineKeyboard,
      type: doc.type || MessageType.TEXT,
    };

    const words = doc.keywords.split(' ');
    tfidf.addDocument(words, label);
  });

  console.info('✅ TFIDF completed, added', tfidf.documents.length, 'docs');
}

loadAndTrain();
