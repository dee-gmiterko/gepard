import styled from 'styled-components';

export const NARROW_EDITOR_WIDTH = '900px';

export const EditorHost = styled.div`
  height: 100%;

  .cm-editor {
    height: 100%;
  }

  @container editor (max-width: ${NARROW_EDITOR_WIDTH}) {
    .cm-lineNumbers,
    .cm-gutter-old,
    .cm-gutter-new {
      display: none;
    }
  }
`;
