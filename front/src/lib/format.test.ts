import { describe, expect, it } from 'vitest'
import { applyFormat } from './format'

function run(marked: string, format: Parameters<typeof applyFormat>[3]) {
  const start = marked.indexOf('[')
  const end = marked.indexOf(']') - 1
  const value = marked.replace('[', '').replace(']', '')
  const edit = applyFormat(value, start, end, format)
  return (
    edit.value.slice(0, edit.start) +
    '[' +
    edit.value.slice(edit.start, edit.end) +
    ']' +
    edit.value.slice(edit.end)
  )
}

describe('applyFormat: wrapping', () => {
  it('wraps the selection and keeps it selected', () => {
    expect(run('say [hi] now', 'bold')).toBe('say **[hi]** now')
    expect(run('say [hi] now', 'italic')).toBe('say _[hi]_ now')
    expect(run('say [hi] now', 'strike')).toBe('say ~~[hi]~~ now')
    expect(run('say [hi] now', 'code')).toBe('say `[hi]` now')
  })

  it('inserts selected placeholder text when nothing is selected', () => {
    expect(run('a[]b', 'bold')).toBe('a**[bold text]**b')
  })

  it('toggles off when the markers surround the selection', () => {
    expect(run('say **[hi]** now', 'bold')).toBe('say [hi] now')
  })

  it('toggles off when the selection includes the markers', () => {
    expect(run('say [**hi**] now', 'bold')).toBe('say [hi] now')
  })

  it("adds italic inside bold without eating bold's stars", () => {
    expect(run('**[x]**', 'italic')).toBe('**_[x]_**')
  })
})

describe('applyFormat: links', () => {
  it('turns selected text into a link and selects the address', () => {
    expect(run('see [docs]', 'link')).toBe('see [docs]([https://])')
  })

  it('uses a selected URL as the target and puts the cursor in the text', () => {
    expect(run('go [example.com]', 'link')).toBe('go [[]](example.com)')
  })
})

describe('applyFormat: lists', () => {
  it('adds bullets to every selected line, skipping blank ones', () => {
    expect(run('[a\n\nb]', 'list')).toBe('[- a\n\n- b]')
  })

  it('works on whole lines even with a partial selection', () => {
    expect(run('one\ntw[o\nth]ree\nfour', 'list')).toBe(
      'one\n[- two\n- three]\nfour'
    )
  })

  it('removes bullets when every line already has one', () => {
    expect(run('[- a\n- b]', 'list')).toBe('[a\nb]')
  })
})

describe('applyFormat: code blocks', () => {
  it('fences the selected lines and keeps the code selected', () => {
    expect(run('intro\nco[nst a = 1\nlog(a])\nend', 'codeblock')).toBe(
      'intro\n```\n[const a = 1\nlog(a)]\n```\nend'
    )
  })

  it('inserts a placeholder on an empty line', () => {
    expect(run('a\n[]', 'codeblock')).toBe('a\n```\n[code]\n```')
  })

  it('removes the fences when the selection is a fenced block', () => {
    expect(run('[```js\nx()\n```]', 'codeblock')).toBe('[x()]')
  })
})
