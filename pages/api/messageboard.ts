import OpenAI from 'openai';

var functions = require('../utils/functions');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const axios = require('axios');

let options = functions.getAPIOptions('POST', 'en-US');

export default async function Action(req, res) {
  let start = new Date().getTime();

  const debug = req.body.debugMode;

  if (debug)
    console.log(
      'mbSectionNumber:' +
        req.body.mbSectionNumber +
        ', mbThreadNumber:' +
        req.body.mbThreadNumber +
        ', mbMessageNumber:' +
        req.body.mbMessageNumber
    );

  const messageBoardSchema = {
    properties: {
      categories: {
        description:
          'An array of ' +
          req.body.mbSectionNumber +
          ' or more message board categories related to the given topic',
        items: {
          properties: {
            category: {
              description: 'Name of the message board category',
              type: 'string',
            },
            threads: {
              description:
                'An array of ' +
                req.body.mbThreadNumber +
                ' message board threads within the category',
              items: {
                properties: {
                  articleBody: {
                    description:
                      'The full message as seen in the message board thread body. Use ' +
                      req.body.mbThreadLength +
                      ' words or more.',
                    type: 'string',
                  },
                  headline: {
                    description: 'The title of the message board thread',
                    type: 'string',
                  },
                  messages: {
                    description:
                      'An array of ' +
                      req.body.mbMessageNumber +
                      ' message board messages within the category',
                    items: {
                      properties: {
                        message: {
                          description:
                            'The message that relates to the message board threads',
                          type: 'string',
                        },
                      },
                      type: 'object',
                    },
                    required: ['messages'],
                    type: 'array',
                  },
                },
                type: 'object',
              },
              required: ['headline', 'articleBody', 'threads'],
              type: 'array',
            },
          },
          type: 'object',
        },
        required: ['categories'],
        type: 'array',
      },
    },
    type: 'object',
  };

  const response = await openai.chat.completions.create({
    functions: [
      { name: 'get_message_board_content', parameters: messageBoardSchema },
    ],
    messages: [
      {
        content:
          'You are a message board administrator responsible for managing the message board for your company.',
        role: 'system',
      },
      {
        content:
          "Create a list of message board categories, threads, and messages on the subject of '" +
          req.body.mbTopic +
          "'. It is important to include " +
          req.body.mbSectionNumber +
          ' or more message board categories, ' +
          req.body.mbThreadNumber +
          ' message board threads in each category, and ' +
          req.body.mbMessageNumber +
          ' message board threads in each thread. ' +
          'Each message board thread should be ' +
          req.body.mbThreadLength +
          ' words or more.',
        role: 'user',
      },
    ],
    model: 'gpt-3.5-turbo',
    temperature: 0.6,
  });

  let categories = JSON.parse(
    response.choices[0].message.function_call.arguments
  ).categories;
  if (debug) console.log(JSON.stringify(categories));

  for (let i = 0; categories.length > i; i++) {
    let sectionApiPath =
      process.env.LIFERAY_PATH +
      '/o/headless-delivery/v1.0/sites/' +
      req.body.siteId +
      '/message-board-sections';

    if (debug) console.log(sectionApiPath);

    let mbSectionJson = {
      title: categories[i].category,
    };

    let mbSectionResponse = await axios.post(
      sectionApiPath,
      mbSectionJson,
      options
    );
    let sectionId = mbSectionResponse.data.id;

    if (debug)
      console.log(
        'C:' + categories[i].category + ' created with id ' + sectionId
      );

    let threads = categories[i].threads;

    for (let t = 0; t < threads.length; t++) {
      let threadApiPath =
        process.env.LIFERAY_PATH +
        '/o/headless-delivery/v1.0/message-board-sections/' +
        sectionId +
        '/message-board-threads';

      if (debug) console.log(threadApiPath);

      let mbThreadJson = {
        articleBody: threads[t].articleBody,
        headline: threads[t].headline,
      };

      let mbThreadResponse = await axios.post(
        threadApiPath,
        mbThreadJson,
        options
      );
      let threadId = mbThreadResponse.data.id;

      if (debug)
        console.log(
          'T:' + threads[t].headline + ' created with id ' + threadId
        );

      let messages = threads[t].messages;
      for (let m = 0; m < messages.length; m++) {
        let messageApiPath =
          process.env.LIFERAY_PATH +
          '/o/headless-delivery/v1.0/message-board-threads/' +
          threadId +
          '/message-board-messages';

        if (debug) console.log(messageApiPath);

        let mbMessageJson = {
          articleBody: messages[m].message,
        };

        let mbMessageThreadResponse = await axios.post(
          messageApiPath,
          mbMessageJson,
          options
        );
        let messageId = mbMessageThreadResponse.data.id;

        if (debug)
          console.log(
            'M:' + messages[m].message + ' created with id ' + messageId
          );
      }
    }
  }

  let end = new Date().getTime();
  res
    .status(200)
    .json({
      result:
        'Completed in ' + functions.millisToMinutesAndSeconds(end - start),
    });
}
