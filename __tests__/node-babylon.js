const babylon = require('babylon');
const fs = require('fs');
const path = require('path');

const nodes = require('..');

const fixtureText = String(
  fs.readFileSync(
    path.resolve(__dirname, './testFixtures/jestExample.txt')
  )
);

test('Should be able to parse a Jest test using babylon', () => {
  expect(() => {
    const file = babylon.parse(fixtureText, {
      sourceType: 'module',
      plugins: ['jsx']
    });
    nodes.build(JSON.parse(JSON.stringify(file)));
  }).not.toThrow();

});

test('Should be able to find toMatchSnapshot', () => {

  const file = babylon.parse(fixtureText, {
    sourceType: 'module',
    plugins: ['jsx']
  });

  const program = nodes.build(JSON.parse(JSON.stringify(file.program)));

  expect(
    program.search('#Identifier > name').includes('toMatchSnapshot')
  ).toBe(true);

})

test('Should get the correct `test` parent from the snapshot', () => {
  const file = babylon.parse(fixtureText, {
    sourceType: 'module',
    plugins: ['jsx']
  });

  const program = nodes.build(JSON.parse(JSON.stringify(file.program)));

  const toMatchSnapshot = program.search('#Identifier').filter(x => x.name === 'toMatchSnapshot')[0];
  let findCall = toMatchSnapshot.parent('#CallExpression');
  while (!findCall.callee || findCall.callee.name !== 'test'){
    findCall = findCall.parent('#CallExpression');
  }

  expect(
    findCall.arguments[0].value
  ).toBe('something very important to test');
})

test('Should be able to work on File nodes', () => {
  const fileNode = babylon.parse(fixtureText, {
    sourceType: 'module',
    plugins: ['jsx']
  });

  expect(() => {
    const file = nodes.build(JSON.parse(JSON.stringify(fileNode)));
  }).not.toThrow();
})
