import { NoticeBox } from '../components/Card'
import { useDemoT } from '../strings/demo'

// Demo only: the email form must not look as if it sent anything.
export function DemoNoEmail() {
  const { sample } = useDemoT()
  return <NoticeBox tone="amber">{sample.noEmail}</NoticeBox>
}
