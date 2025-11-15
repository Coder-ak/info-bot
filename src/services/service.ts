import fs from 'fs';
import path from 'path';
import { TfIdf } from 'natural/lib/natural/tfidf/index.js';
import stemmer from 'natural/lib/natural/stemmers/index.js';
import tokenizers from 'natural/lib/natural/tokenizers/index.js';
import { franc } from 'franc-min';
import { removeStopwords, rus, ukr } from 'stopword';

import { DataEntry, ScriptResult } from '../types/types.js';
import { LANGS, CUSTOM_STOP_WORDS, MessageType } from '../enums/enums.js';

const DATA_PATH = process.env.DATA_PATH ?? 'data/data.json';

let data: DataEntry[] = [];
let infoData: Record<string, ScriptResult> = {};
let tfidf: TfIdf;

export function getResult(query: string): ScriptResult {
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

  console.log('↓INFO-BOT-SERVER:', {
    lang,
    query,
    tokens,
    scores: scores.slice(0, 3),
  });

  if (!bestLabel || bestLabel?.score === 0) {
    return {
      message:
        'Вибачте, але я не знайшов інформацію по вашому запиту.\n\nСпробуйте  щось на кшталт: <code>диспетчер</code>, <code>сантехнік</code>, <code>аптека</code>, <code>допомога</code>...',
      inlineKeyboard: [
        [{ text: '⚡️ Світло є?', callback_data: '/light' }],
        [{ text: '📆 Графік вимкнень', callback_data: '/schedule' }],
      ],
      type: MessageType.TEXT,
    };
  }

  return {
    message: infoData[bestLabel.id].message,
    caption: infoData[bestLabel.id].caption,
    inlineKeyboard: infoData[bestLabel.id].inlineKeyboard,
    type: infoData[bestLabel.id].type,
    score: bestLabel.score,
    label: bestLabel.id,
  };
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
