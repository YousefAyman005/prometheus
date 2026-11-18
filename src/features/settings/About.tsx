import { useEffect, useState } from 'react'
import { isStandalone, requestPersistentStorage } from '../../platform/device'
import { useApp } from '../../store'
import { Row, Section } from '../../ui/List'

function size(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`
}

/** Facts for checking an install: useful when a friend says "it lost my data". */
export function About() {
  const data = useApp((s) => s.data)
  const saveError = useApp((s) => s.saveError)
  const [persisted, setPersisted] = useState<boolean | null | 'checking'>('checking')

  useEffect(() => {
    void requestPersistentStorage().then(setPersisted)
  }, [])

  const protection = persisted === 'checking' ? '…' : persisted === null ? 'Unknown' : persisted ? 'Yes' : 'No'

  return (
    <Section title="About" footer={saveError ? `Changes are not being saved (${saveError}).` : undefined}>
      <Row label="Version" detail={__APP_VERSION__} />
      <Row label="Opened as an app" detail={isStandalone() ? 'Yes' : 'No, in the browser'} />
      <Row label="Storage protected" detail={protection} />
      <Row label="Habits" detail={Object.keys(data.habits).length} />
      <Row label="Logged entries" detail={Object.keys(data.entries).length} />
      <Row label="Data size" detail={size(JSON.stringify(data).length)} />
    </Section>
  )
}
