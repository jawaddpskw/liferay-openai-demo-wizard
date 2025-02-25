import hljs from 'highlight.js';
import { useState } from 'react';
import React from 'react';

import functions from './utils/functions';
import AppFooter from './components/appfooter';
import AppHead from './components/apphead';
import AppHeader from './components/appheader';
import FieldString from './components/formfield-string';
import FieldToggle from './components/formfield-toggle';
import FieldSubmit from './components/formfield-submit';
import LoadingAnimation from './components/loadinganimation';
import ResultDisplay from './components/resultdisplay';

export default function Review() {
  const [pageTopicInput, setPageTopicInput] = useState(
    'Company Intranet Portal'
  );
  const [childPageNumberInput, setChildPageNumberInput] =
    useState('3');
  const [pageNumberInput, setPageNumberInput] = useState('8');
  const [siteIdInput, setSiteIdInput] = useState('');
  const [addPageContentInput, setAddPageContent] = useState(true);

  const [result, setResult] = useState(() => '');
  const [isLoading, setIsLoading] = useState(false);

  const [appConfig, setAppConfig] = useState({
    model:functions.getDefaultAIModel()
  });

  const handlePageContentChange = (value) => {
    setAddPageContent(!addPageContentInput);
  };

  async function onSubmit(event) {
    event.preventDefault();
    setIsLoading(true);

    const response = await fetch('/api/pages-ai', {
      body: JSON.stringify({
        config: appConfig,
        pageTopic: pageTopicInput,
        siteId:siteIdInput,
        pageNumber: pageNumberInput,
        addPageContent:addPageContentInput,
        childPageNumber: childPageNumberInput
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });
    const data = await response.json();
    console.log('data', data);

    const hljsResult = hljs.highlightAuto(data.result).value;
    setResult(hljsResult);

    setIsLoading(false);
  }

  return (
    <div>
      <AppHead title="Page Generator" />

      <main className="py-20 flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#0b1d67] to-[#204f79]">
        <AppHeader
          desc='Type your business description in the field below and wait for your pages. Examples of site descriptions are "automotive supplier portal", "college student portal", or "botanical hobbyist site".'
          title='Liferay Page Generator'
        />

        <form onSubmit={onSubmit}>
          <div className="w-700 grid grid-cols-2 gap-2 sm:grid-cols-2 md:gap-4 mb-5">
            <FieldString
              defaultValue="Company Intranet Portal"
              inputChange={setPageTopicInput}
              label="Site Description"
              name="siteTopic"
              placeholder="Enter a site description"
            />

            <FieldString
              defaultValue=""
              inputChange={setSiteIdInput}
              label="Site ID"
              name="siteId"
              placeholder="Enter id of the site that you would like to add pages to"
            />

            <FieldString
              defaultValue="8"
              inputChange={setPageNumberInput}
              label="Maximum Number of Pages"
              name="numberOfPages"
              placeholder="Enter a the max number of top level pages to generate"
            />

            <FieldString
              defaultValue="3"
              inputChange={setChildPageNumberInput}
              label="Maximum Number of Child Pages"
              name="numberOfChildPages"
              placeholder="Enter a the max number of child pages to generate"
            />

            <FieldToggle
              defaultValue={true}
              fieldKey="addContent"
              inputChange={handlePageContentChange}
              name="Generate Page Content (EARLY RELEASE, increases content generation time)"
            />

          </div>

          <FieldSubmit disabled={isLoading} label="Generate Pages" />
        </form>

        <p className="text-slate-100 text-center text-lg mb-3 rounded p-5 bg-white/10 w-1/2 italic">
          <b>Note:</b> The AI generation of page lists was not dependable for GPT 3.5. Because of this, GPT 4.0 is automatically enforced for generating a complete page structure. Subsequent calls will use the selected model.
        </p>

        {isLoading ? (
          <LoadingAnimation />
        ) : (
          result && <ResultDisplay result={result} />
        )}
      </main>

      <AppFooter setConfig={setAppConfig}/>
    </div>
  );
}
