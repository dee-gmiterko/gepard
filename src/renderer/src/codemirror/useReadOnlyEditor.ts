import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useTheme } from 'styled-components'
import { Compartment, EditorState, type Extension, type Text } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { LanguageDescription } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { useCommands } from '../keyboard/commands'
import { readOnlyExtensions } from './setup'
import { editorTheme } from './theme'
import { keymapBridge } from './keymapBridge'
import { reportError } from '../errors/report'

export interface ReadOnlyEditor {
  containerRef: RefObject<HTMLDivElement | null>
  view: EditorView | null
  comments: Compartment
  commentGutter: Compartment
}

export function useReadOnlyEditor(
  path: string,
  doc: string | Text,
  extensions: Extension
): ReadOnlyEditor {
  const theme = useTheme()
  const commands = useCommands()
  const commandsRef = useRef(commands)
  useLayoutEffect(() => {
    commandsRef.current = commands
  })

  const containerRef = useRef<HTMLDivElement | null>(null)
  const [view, setView] = useState<EditorView | null>(null)
  const compartments = useMemo(
    () => ({
      theme: new Compartment(),
      language: new Compartment(),
      comments: new Compartment(),
      commentGutter: new Compartment()
    }),
    []
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const newView = new EditorView({
      state: EditorState.create({
        doc,
        extensions: [
          readOnlyExtensions(),
          extensions,
          compartments.theme.of([]),
          compartments.language.of([]),
          compartments.comments.of([]),
          compartments.commentGutter.of([]),
          keymapBridge(() => commandsRef.current)
        ]
      }),
      parent: el
    })
    setView(newView)

    let cancelled = false
    const desc = LanguageDescription.matchFilename(languages, path)
    if (desc) {
      desc.load().then(
        (support) => {
          if (!cancelled) newView.dispatch({ effects: compartments.language.reconfigure(support) })
        },
        (e: Error) =>
          reportError({
            scope: 'language-support',
            message: `Syntax highlighting for ${path} failed to load; showing plain text.`,
            tone: 'warning',
            detail: e.stack ?? e.message
          })
      )
    }

    return () => {
      cancelled = true
      newView.destroy()
      setView(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, doc, compartments])

  useEffect(() => {
    view?.dispatch({ effects: compartments.theme.reconfigure(editorTheme(theme)) })
  }, [theme, view, compartments])

  return {
    containerRef,
    view,
    comments: compartments.comments,
    commentGutter: compartments.commentGutter
  }
}
