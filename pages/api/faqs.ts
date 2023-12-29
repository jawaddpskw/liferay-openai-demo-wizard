import axios from 'axios';
import OpenAI from 'openai';

import functions from '../utils/functions';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function Action(req, res) {
  let start = new Date().getTime();

  const debug = req.body.debugMode;

  if (debug)
    console.log('req.body.languages.length: ' + req.body.languages.length);
  if (debug) console.log('req.body.manageLanguage: ' + req.body.manageLanguage);
  if (debug)
    console.log('req.body.defaultLanguage: ' + req.body.defaultLanguage);
  if (debug)
    console.log(
      'getLanguageDisplayName ' +
        functions.getLanguageDisplayName(req.body.language)
    );

  let storedProperties = {
    answer: {
      description:
        'Answer to the frequently asked question. Answers over 30 words are preferred.',
      type: 'string',
    },
    title: {
      description: 'Frequently asked question',
      type: 'string',
    },
  };

  let requiredFields = ['title', 'answer'];
  let languages = req.body.languages;

  if (req.body.manageLanguage) {
    for (let i = 0; i < languages.length; i++) {
      storedProperties['title_' + languages[i]] = {
        description:
          'Frequently asked question translated into ' +
          functions.getLanguageDisplayName(languages[i]),
        type: 'string',
      };
      requiredFields.push('title_' + languages[i]);

      storedProperties['answer_' + languages[i]] = {
        description:
          'Answer to the frequently asked question translated into ' +
          functions.getLanguageDisplayName(languages[i]),
        type: 'string',
      };
      requiredFields.push('answer_' + languages[i]);
    }
  }

  const faqSchema = {
    properties: {
      faqs: {
        description:
          'An array of ' + req.body.faqNumber + ' frequently asked questions',
        items: {
          properties: storedProperties,
          required: requiredFields,
          type: 'object',
        },
        required: ['faqs'],
        type: 'array',
      },
    },
    type: 'object',
  };

  const response = await openai.chat.completions.create({
    functions: [{ name: 'get_faqs', parameters: faqSchema }],
    messages: [
      {
        content:
          'You are an administrator responsible for defining frequently asked questions.',
        role: 'system',
      },
      {
        content:
          'Create a list of frequently asked questions and answers on the subject of: ' +
          req.body.faqTopic,
        role: 'user',
      },
    ],
    model: 'gpt-3.5-turbo',
    temperature: 0.6,
  });

  let faqs = JSON.parse(
    response.choices[0].message.function_call.arguments
  ).faqs;
  if (debug) console.log(JSON.stringify(faqs));

  for (let i = 0; i < faqs.length; i++) {
    if (debug) console.log(faqs[i]);

    let postBody = {
      contentStructureId: req.body.structureId,
      siteId: req.body.siteId,
      structuredContentFolderId: req.body.folderId,
      taxonomyCategoryIds: functions.returnArraySet(req.body.categoryIds),
      title: faqs[i].title,
    };

    let setContentFields = [
      {
        contentFieldValue: {
          data: faqs[i].answer,
        },
        name: 'Answer',
      },
    ];

    if (req.body.manageLanguage) {
      let contentFieldValues = {};
      let titleValues = {};

      for (let l = 0; l < languages.length; l++) {
        contentFieldValues = {};
        titleValues = {};

        for (const [key, value] of Object.entries(faqs[i])) {
          try {
            if (debug) console.log(`${l} : ${key}`);

            if (key.indexOf('_')) {
              let keySplit = key.split('_');

              if (keySplit[0] == 'title') titleValues[keySplit[1]] = value;

              if (keySplit[0] == 'answer')
                contentFieldValues[keySplit[1]] = { data: value };
            }
          } catch (error) {
            if (debug)
              console.log(
                'unable to process translation for faq ' +
                  l +
                  ' : ' +
                  languages[l]
              );
            if (debug) console.log(error);
          }
        }
      }

      setContentFields[0]['contentFieldValue_i18n'] = contentFieldValues;
      postBody['title_i18n'] = titleValues;
    }

    postBody['contentFields'] = setContentFields;

    if (debug) console.log('postBody');
    if (debug) console.log(JSON.stringify(postBody));

    let faqApiPath =
      process.env.LIFERAY_PATH +
      '/o/headless-delivery/v1.0/sites/' +
      req.body.siteId +
      '/structured-contents';

    const options = functions.getAPIOptions('POST', req.body.defaultLanguage);

    try {
      const response = await axios.post(faqApiPath, postBody, options);

      if (debug) console.log(response.data);
    } catch (error) {
      console.log(error);
    }
  }

  let end = new Date().getTime();

  res.status(200).json({
    result: 'Completed in ' + functions.millisToMinutesAndSeconds(end - start),
  });
}
