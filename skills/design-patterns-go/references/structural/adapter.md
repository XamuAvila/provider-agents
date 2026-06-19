# Adapter (Go)

**Categoria:** Structural  
**Fonte:** https://refactoring.guru/pt-br/design-patterns/adapter/go/example

## Intenção

O Adapter é um padrão de projeto estrutural, que permite a colaboração de objetos incompatíveis.

O Adapter atua como um wrapper entre dois objetos. Ele captura chamadas para um objeto e as deixa reconhecíveis tanto em formato como interface para este segundo objeto.

## Contexto do Exemplo

Temos um código cliente que espera alguns recursos de um objeto (Lightning port), mas temos outro objeto chamado adaptee (laptop Windows) que oferece a mesma funcionalidade, mas por meio de uma interface diferente (porta USB)

É aqui que o padrão Adapter entra em cena. Criamos um tipo de struct conhecido como adapter que irá:

Seguir a mesma interface que o cliente espera (Lightning port).

## Implementação em Go

### `client.go` — Código cliente

```go
package main

import "fmt"

type Client struct {
}

func (c *Client) InsertLightningConnectorIntoComputer(com Computer) {
	fmt.Println("Client inserts Lightning connector into computer.")
	com.InsertIntoLightningPort()
}
```

### `computer.go` — Interface cliente

```go
package main

type Computer interface {
	InsertIntoLightningPort()
}
```

### `mac.go` — Serviço

```go
package main

import "fmt"

type Mac struct {
}

func (m *Mac) InsertIntoLightningPort() {
	fmt.Println("Lightning connector is plugged into mac machine.")
}
```

### `windows.go` — Serviço desconhecido

```go
package main

import "fmt"

type Windows struct{}

func (w *Windows) insertIntoUSBPort() {
	fmt.Println("USB connector is plugged into windows machine.")
}
```

### `windowsadapter.go`

```go
package main

import "fmt"

type WindowsAdapter struct {
	windowMachine *Windows
}

func (w *WindowsAdapter) InsertIntoLightningPort() {
	fmt.Println("Adapter converts Lightning signal to USB.")
	w.windowMachine.insertIntoUSBPort()
}
```

### `main.go`

```go
package main

func main() {

	client := &Client{}
	mac := &Mac{}

	client.InsertLightningConnectorIntoComputer(mac)

	windowsMachine := &Windows{}
	windowsMachineAdapter := &WindowsAdapter{
		windowMachine: windowsMachine,
	}

	client.InsertLightningConnectorIntoComputer(windowsMachineAdapter)
}
```
